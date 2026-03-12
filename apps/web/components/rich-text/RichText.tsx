'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  Bold, Italic, Underline, Strikethrough, Link, Image, 
  List, ListOrdered, Quote, Code, Heading1, Heading2, Heading3,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Undo, Redo, Type, Palette, X
} from 'lucide-react';

// ============================================================================
// Toolbar Button
// ============================================================================

interface ToolbarButtonProps {
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  title?: string;
}

function ToolbarButton({ icon, active, onClick, title }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-2 rounded-lg transition-colors ${
        active
          ? 'bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-400'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
      }`}
    >
      {icon}
    </button>
  );
}

// ============================================================================
// Rich Text Editor
// ============================================================================

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  showToolbar?: boolean;
  readOnly?: boolean;
  className?: string;
}

export function RichTextEditor({
  value = '',
  onChange,
  placeholder = 'Start typing...',
  minHeight = 200,
  maxHeight = 500,
  showToolbar = true,
  readOnly = false,
  className = '',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    updateActiveFormats();
  };

  const updateActiveFormats = () => {
    const formats = new Set<string>();
    if (document.queryCommandState('bold')) formats.add('bold');
    if (document.queryCommandState('italic')) formats.add('italic');
    if (document.queryCommandState('underline')) formats.add('underline');
    if (document.queryCommandState('strikeThrough')) formats.add('strikethrough');
    if (document.queryCommandState('insertOrderedList')) formats.add('orderedList');
    if (document.queryCommandState('insertUnorderedList')) formats.add('unorderedList');
    setActiveFormats(formats);
  };

  const handleInput = () => {
    if (editorRef.current && onChange) {
      onChange(editorRef.current.innerHTML);
    }
    updateActiveFormats();
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const insertImage = () => {
    const url = prompt('Enter image URL:');
    if (url) {
      execCommand('insertImage', url);
    }
  };

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  return (
    <div className={`border border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden ${className}`}>
      {showToolbar && !readOnly && (
        <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-1">
            <ToolbarButton
              icon={<Bold className="w-4 h-4" />}
              active={activeFormats.has('bold')}
              onClick={() => execCommand('bold')}
              title="Bold"
            />
            <ToolbarButton
              icon={<Italic className="w-4 h-4" />}
              active={activeFormats.has('italic')}
              onClick={() => execCommand('italic')}
              title="Italic"
            />
            <ToolbarButton
              icon={<Underline className="w-4 h-4" />}
              active={activeFormats.has('underline')}
              onClick={() => execCommand('underline')}
              title="Underline"
            />
            <ToolbarButton
              icon={<Strikethrough className="w-4 h-4" />}
              active={activeFormats.has('strikethrough')}
              onClick={() => execCommand('strikeThrough')}
              title="Strikethrough"
            />
          </div>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          <div className="flex items-center gap-1">
            <ToolbarButton
              icon={<Heading1 className="w-4 h-4" />}
              onClick={() => execCommand('formatBlock', 'h1')}
              title="Heading 1"
            />
            <ToolbarButton
              icon={<Heading2 className="w-4 h-4" />}
              onClick={() => execCommand('formatBlock', 'h2')}
              title="Heading 2"
            />
            <ToolbarButton
              icon={<Heading3 className="w-4 h-4" />}
              onClick={() => execCommand('formatBlock', 'h3')}
              title="Heading 3"
            />
          </div>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          <div className="flex items-center gap-1">
            <ToolbarButton
              icon={<List className="w-4 h-4" />}
              active={activeFormats.has('unorderedList')}
              onClick={() => execCommand('insertUnorderedList')}
              title="Bullet List"
            />
            <ToolbarButton
              icon={<ListOrdered className="w-4 h-4" />}
              active={activeFormats.has('orderedList')}
              onClick={() => execCommand('insertOrderedList')}
              title="Numbered List"
            />
            <ToolbarButton
              icon={<Quote className="w-4 h-4" />}
              onClick={() => execCommand('formatBlock', 'blockquote')}
              title="Quote"
            />
            <ToolbarButton
              icon={<Code className="w-4 h-4" />}
              onClick={() => execCommand('formatBlock', 'pre')}
              title="Code Block"
            />
          </div>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          <div className="flex items-center gap-1">
            <ToolbarButton
              icon={<AlignLeft className="w-4 h-4" />}
              onClick={() => execCommand('justifyLeft')}
              title="Align Left"
            />
            <ToolbarButton
              icon={<AlignCenter className="w-4 h-4" />}
              onClick={() => execCommand('justifyCenter')}
              title="Align Center"
            />
            <ToolbarButton
              icon={<AlignRight className="w-4 h-4" />}
              onClick={() => execCommand('justifyRight')}
              title="Align Right"
            />
          </div>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          <div className="flex items-center gap-1">
            <ToolbarButton
              icon={<Link className="w-4 h-4" />}
              onClick={insertLink}
              title="Insert Link"
            />
            <ToolbarButton
              icon={<Image className="w-4 h-4" aria-label="Insert image" />}
              onClick={insertImage}
              title="Insert Image"
            />
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1">
            <ToolbarButton
              icon={<Undo className="w-4 h-4" />}
              onClick={() => execCommand('undo')}
              title="Undo"
            />
            <ToolbarButton
              icon={<Redo className="w-4 h-4" />}
              onClick={() => execCommand('redo')}
              title="Redo"
            />
          </div>
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable={!readOnly}
        onInput={handleInput}
        onSelect={updateActiveFormats}
        className="p-4 focus:outline-none overflow-auto prose dark:prose-invert max-w-none"
        style={{ minHeight, maxHeight }}
        data-placeholder={placeholder}
      />

      <style>{`
        [data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: #9ca3af;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Markdown Editor
// ============================================================================

interface MarkdownEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  preview?: boolean;
  className?: string;
}

export function MarkdownEditor({
  value = '',
  onChange,
  placeholder = 'Write in markdown...',
  minHeight = 200,
  preview = true,
  className = '',
}: MarkdownEditorProps) {
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertMarkdown = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newValue = 
      value.substring(0, start) + 
      before + selectedText + after + 
      value.substring(end);
    
    onChange?.(newValue);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        end + before.length
      );
    }, 0);
  };

  // Sanitize HTML to prevent XSS attacks
  const sanitizeHtml = (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // Simple markdown to HTML conversion (for preview) - with XSS protection
  const parseMarkdown = (md: string): string => {
    // Sanitize first to prevent XSS
    const sanitized = sanitizeHtml(md);
    return sanitized
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/~~(.+?)~~/g, '<del>$1</del>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
      .replace(/^\* (.+$)/gm, '<li>$1</li>')
      .replace(/^\d\. (.+$)/gm, '<li>$1</li>')
      .replace(/\n/g, '<br />');
  };

  return (
    <div className={`border border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden ${className}`}>
      <div className="flex items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <ToolbarButton
          icon={<Bold className="w-4 h-4" />}
          onClick={() => insertMarkdown('**', '**')}
          title="Bold"
        />
        <ToolbarButton
          icon={<Italic className="w-4 h-4" />}
          onClick={() => insertMarkdown('*', '*')}
          title="Italic"
        />
        <ToolbarButton
          icon={<Strikethrough className="w-4 h-4" />}
          onClick={() => insertMarkdown('~~', '~~')}
          title="Strikethrough"
        />
        <ToolbarButton
          icon={<Code className="w-4 h-4" />}
          onClick={() => insertMarkdown('`', '`')}
          title="Code"
        />
        <ToolbarButton
          icon={<Link className="w-4 h-4" />}
          onClick={() => insertMarkdown('[', '](url)')}
          title="Link"
        />
        <ToolbarButton
          icon={<List className="w-4 h-4" />}
          onClick={() => insertMarkdown('* ')}
          title="List"
        />

        <div className="flex-1" />

        {preview && (
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              showPreview
                ? 'bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-400'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            {showPreview ? 'Edit' : 'Preview'}
          </button>
        )}
      </div>

      {showPreview ? (
        <div
          className="p-4 prose dark:prose-invert max-w-none overflow-auto"
          style={{ minHeight }}
          dangerouslySetInnerHTML={{ __html: parseMarkdown(value) }}
        />
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          className="w-full p-4 resize-none focus:outline-none font-mono text-sm bg-transparent"
          style={{ minHeight }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Character Counter
// ============================================================================

interface CharacterCounterProps {
  value: string;
  maxLength?: number;
  showWords?: boolean;
  className?: string;
}

export function CharacterCounter({
  value,
  maxLength,
  showWords = true,
  className = '',
}: CharacterCounterProps) {
  const charCount = value.length;
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const isOverLimit = maxLength !== undefined && charCount > maxLength;

  return (
    <div className={`flex items-center gap-3 text-sm ${className}`}>
      {showWords && (
        <span className="text-gray-500 dark:text-gray-400">
          {wordCount} word{wordCount !== 1 ? 's' : ''}
        </span>
      )}
      <span className={isOverLimit ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}>
        {charCount}
        {maxLength && ` / ${maxLength}`}
      </span>
    </div>
  );
}

// ============================================================================
// Mention Input
// ============================================================================

interface Mention {
  id: string;
  name: string;
  avatar?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  mentions: Mention[];
  placeholder?: string;
  className?: string;
}

export function MentionInput({
  value,
  onChange,
  mentions,
  placeholder = 'Type @ to mention someone...',
  className = '',
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [query, setQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const filteredMentions = mentions.filter(m =>
    m.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursor = e.target.selectionStart;
    setCursorPosition(cursor);
    onChange(newValue);

    // Check for @ trigger
    const textBeforeCursor = newValue.substring(0, cursor);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      setQuery(mentionMatch[1]);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const insertMention = (mention: Mention) => {
    const textBeforeCursor = value.substring(0, cursorPosition);
    const mentionStart = textBeforeCursor.lastIndexOf('@');
    const newValue = 
      value.substring(0, mentionStart) + 
      `@${mention.name} ` + 
      value.substring(cursorPosition);
    
    onChange(newValue);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`}>
      <textarea
        ref={inputRef}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
        rows={3}
      />

      <AnimatePresence>
        {showSuggestions && filteredMentions.length > 0 && (
          <motion.div key="suggestions"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden z-50"
          >
            {filteredMentions.map(mention => (
              <button
                key={mention.id}
                onClick={() => insertMention(mention)}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
              >
                {mention.avatar ? (
                  <img
                    src={mention.avatar}
                    alt={mention.name}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900 rounded-full flex items-center justify-center text-violet-600 dark:text-violet-400 font-medium">
                    {mention.name[0]}
                  </div>
                )}
                <span className="text-gray-900 dark:text-white">{mention.name}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Tag Editor
// ============================================================================

interface TagEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  maxTags?: number;
  className?: string;
}

export function TagEditor({
  tags,
  onChange,
  suggestions = [],
  placeholder = 'Add tags...',
  maxTags,
  className = '',
}: TagEditorProps) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredSuggestions = suggestions.filter(
    s => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s)
  );

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      if (!maxTags || tags.length < maxTags) {
        onChange([...tags, trimmed]);
      }
    }
    setInput('');
    setShowSuggestions(false);
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input) {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex flex-wrap items-center gap-2 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus-within:ring-2 focus-within:ring-violet-500 focus-within:border-transparent cursor-text"
      >
        {tags.map((tag, index) => (
          <motion.span
            key={tag}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="inline-flex items-center gap-1 px-2 py-1 bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 rounded-md text-sm"
          >
            {tag}
            <button
              onClick={() => removeTag(index)}
              className="hover:text-violet-900 dark:hover:text-violet-100"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={e => {
            setInput(e.target.value);
            setShowSuggestions(e.target.value.length > 0);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => input && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent focus:outline-none"
          disabled={maxTags !== undefined && tags.length >= maxTags}
        />
      </div>

      <AnimatePresence>
        {showSuggestions && filteredSuggestions.length > 0 && (
          <motion.div key="suggestions"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden z-50 max-h-48 overflow-y-auto"
          >
            {filteredSuggestions.map(suggestion => (
              <button
                key={suggestion}
                onClick={() => addTag(suggestion)}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
              >
                {suggestion}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {maxTags && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {tags.length} / {maxTags} tags
        </p>
      )}
    </div>
  );
}
