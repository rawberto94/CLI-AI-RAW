'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, ChevronRight, Folder, FolderOpen, File, 
  FileText, Image, Code, Film, Music, Archive, 
  ChevronUp, MoreHorizontal, Plus, Trash2, Edit2, Copy
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface TreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  children?: TreeNode[];
  icon?: React.ReactNode;
  data?: Record<string, unknown>;
}

// ============================================================================
// File Icon Helper
// ============================================================================

function getFileIcon(filename: string): React.ComponentType<{ className?: string }> {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    // Images
    jpg: Image, jpeg: Image, png: Image, gif: Image, svg: Image, webp: Image,
    // Code
    ts: Code, tsx: Code, js: Code, jsx: Code, html: Code, css: Code, json: Code, py: Code,
    // Documents
    pdf: FileText, doc: FileText, docx: FileText, txt: FileText, md: FileText,
    // Media
    mp4: Film, mov: Film, avi: Film, mkv: Film,
    mp3: Music, wav: Music, flac: Music,
    // Archives
    zip: Archive, rar: Archive, tar: Archive, gz: Archive,
  };
  
  return iconMap[ext || ''] || File;
}

// ============================================================================
// Tree View
// ============================================================================

interface TreeViewProps {
  data: TreeNode[];
  onSelect?: (node: TreeNode) => void;
  onExpand?: (node: TreeNode, expanded: boolean) => void;
  selectedId?: string;
  expandedIds?: string[];
  defaultExpandedIds?: string[];
  showIcons?: boolean;
  indent?: number;
  className?: string;
}

export function TreeView({
  data,
  onSelect,
  onExpand,
  selectedId,
  expandedIds: controlledExpandedIds,
  defaultExpandedIds = [],
  showIcons = true,
  indent = 20,
  className = '',
}: TreeViewProps) {
  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<string>>(
    new Set(defaultExpandedIds)
  );
  
  const expandedIds = controlledExpandedIds 
    ? new Set(controlledExpandedIds) 
    : internalExpandedIds;

  const toggleExpand = (node: TreeNode) => {
    const newExpanded = new Set(expandedIds);
    const isExpanded = newExpanded.has(node.id);
    
    if (isExpanded) {
      newExpanded.delete(node.id);
    } else {
      newExpanded.add(node.id);
    }
    
    if (!controlledExpandedIds) {
      setInternalExpandedIds(newExpanded);
    }
    
    onExpand?.(node, !isExpanded);
  };

  return (
    <div className={`py-1 ${className}`} role="tree">
      {data.map(node => (
        <TreeNode
          key={node.id}
          node={node}
          level={0}
          expandedIds={expandedIds}
          selectedId={selectedId}
          onSelect={onSelect}
          onToggleExpand={toggleExpand}
          showIcons={showIcons}
          indent={indent}
        />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  node: TreeNode;
  level: number;
  expandedIds: Set<string>;
  selectedId?: string;
  onSelect?: (node: TreeNode) => void;
  onToggleExpand: (node: TreeNode) => void;
  showIcons: boolean;
  indent: number;
}

function TreeNode({
  node,
  level,
  expandedIds,
  selectedId,
  onSelect,
  onToggleExpand,
  showIcons,
  indent,
}: TreeNodeProps) {
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const hasChildren = node.type === 'folder' && node.children && node.children.length > 0;
  
  const FileIcon = node.type === 'file' ? getFileIcon(node.name) : null;

  return (
    <div role="treeitem" aria-expanded={isExpanded}>
      <div
        onClick={() => {
          if (hasChildren) {
            onToggleExpand(node);
          }
          onSelect?.(node);
        }}
        style={{ paddingLeft: level * indent + 8 }}
        className={`
          flex items-center gap-2 py-1.5 px-2 cursor-pointer rounded-lg mx-1
          transition-colors
          ${isSelected 
            ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
            : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
          }
        `}
      >
        {hasChildren ? (
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </motion.div>
        ) : (
          <span className="w-4" />
        )}
        
        {showIcons && (
          node.icon || (
            node.type === 'folder' ? (
              isExpanded ? (
                <FolderOpen className="w-4 h-4 text-yellow-500" />
              ) : (
                <Folder className="w-4 h-4 text-yellow-500" />
              )
            ) : (
              FileIcon && <FileIcon className="w-4 h-4 text-gray-400" />
            )
          )
        )}
        
        <span className="text-sm truncate">{node.name}</span>
      </div>
      
      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
          >
            {node.children?.map(child => (
              <TreeNode
                key={child.id}
                node={child}
                level={level + 1}
                expandedIds={expandedIds}
                selectedId={selectedId}
                onSelect={onSelect}
                onToggleExpand={onToggleExpand}
                showIcons={showIcons}
                indent={indent}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// File Browser
// ============================================================================

interface FileBrowserProps {
  data: TreeNode[];
  onFileSelect?: (node: TreeNode) => void;
  onFolderSelect?: (node: TreeNode) => void;
  onContextMenu?: (node: TreeNode, event: React.MouseEvent) => void;
  selectedId?: string;
  className?: string;
}

export function FileBrowser({
  data,
  onFileSelect,
  onFolderSelect,
  onContextMenu,
  selectedId,
  className = '',
}: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState<TreeNode[]>([]);
  const [currentFolder, setCurrentFolder] = useState<TreeNode | null>(null);

  const currentItems = currentFolder?.children || data;

  const navigateToFolder = (node: TreeNode) => {
    setCurrentPath(prev => [...prev, node]);
    setCurrentFolder(node);
    onFolderSelect?.(node);
  };

  const navigateUp = () => {
    const newPath = currentPath.slice(0, -1);
    setCurrentPath(newPath);
    setCurrentFolder(newPath[newPath.length - 1] || null);
  };

  const navigateToIndex = (index: number) => {
    if (index === -1) {
      setCurrentPath([]);
      setCurrentFolder(null);
    } else {
      const newPath = currentPath.slice(0, index + 1);
      setCurrentPath(newPath);
      setCurrentFolder(newPath[index]);
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => navigateToIndex(-1)}
          className="px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-sm text-gray-700 dark:text-gray-300"
        >
          Root
        </button>
        {currentPath.map((node, index) => (
          <React.Fragment key={node.id}>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <button
              onClick={() => navigateToIndex(index)}
              className="px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-sm text-gray-700 dark:text-gray-300"
            >
              {node.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* File grid */}
      <div className="flex-1 overflow-auto p-4">
        {currentPath.length > 0 && (
          <button
            onClick={navigateUp}
            className="flex items-center gap-2 p-3 mb-2 w-full hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ChevronUp className="w-5 h-5 text-gray-400" />
            <span className="text-gray-500">..</span>
          </button>
        )}
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {currentItems.map(node => {
            const FileIcon = node.type === 'file' ? getFileIcon(node.name) : null;
            
            return (
              <button
                key={node.id}
                onClick={() => {
                  if (node.type === 'folder') {
                    navigateToFolder(node);
                  } else {
                    onFileSelect?.(node);
                  }
                }}
                onContextMenu={e => onContextMenu?.(node, e)}
                className={`
                  flex flex-col items-center gap-2 p-3 rounded-lg transition-colors
                  ${selectedId === node.id 
                    ? 'bg-blue-100 dark:bg-blue-900' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  }
                `}
              >
                {node.type === 'folder' ? (
                  <Folder className="w-10 h-10 text-yellow-500" />
                ) : (
                  FileIcon && <FileIcon className="w-10 h-10 text-gray-400" />
                )}
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate w-full text-center">
                  {node.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Collapsible Section
// ============================================================================

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleSection({
  title,
  defaultOpen = true,
  badge,
  actions,
  children,
  className = '',
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </motion.div>
          <span className="font-medium text-gray-900 dark:text-white">{title}</span>
          {badge}
        </div>
        {actions && (
          <div onClick={e => e.stopPropagation()}>
            {actions}
          </div>
        )}
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Accordion
// ============================================================================

interface AccordionItem {
  id: string;
  title: string;
  content: React.ReactNode;
  icon?: React.ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  allowMultiple?: boolean;
  defaultOpenIds?: string[];
  className?: string;
}

export function Accordion({
  items,
  allowMultiple = false,
  defaultOpenIds = [],
  className = '',
}: AccordionProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(defaultOpenIds));

  const toggle = (id: string) => {
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (!allowMultiple) {
          next.clear();
        }
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className={`divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${className}`}>
      {items.map(item => (
        <div key={item.id}>
          <button
            onClick={() => toggle(item.id)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              {item.icon}
              <span className="font-medium text-gray-900 dark:text-white text-left">
                {item.title}
              </span>
            </div>
            <motion.div
              animate={{ rotate: openIds.has(item.id) ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-5 h-5 text-gray-500" />
            </motion.div>
          </button>
          
          <AnimatePresence>
            {openIds.has(item.id) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="px-4 pb-4 text-gray-600 dark:text-gray-400">
                  {item.content}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Simple List
// ============================================================================

interface ListItem {
  id: string;
  primary: string;
  secondary?: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
}

interface SimpleListProps {
  items: ListItem[];
  hoverable?: boolean;
  divided?: boolean;
  className?: string;
}

export function SimpleList({
  items,
  hoverable = true,
  divided = true,
  className = '',
}: SimpleListProps) {
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden ${className}`}>
      {items.map((item, index) => (
        <div
          key={item.id}
          onClick={item.onClick}
          className={`
            flex items-center gap-3 px-4 py-3
            ${hoverable && item.onClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800' : ''}
            ${divided && index > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''}
          `}
        >
          {item.icon && (
            <div className="shrink-0">{item.icon}</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">
              {item.primary}
            </p>
            {item.secondary && (
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {item.secondary}
              </p>
            )}
          </div>
          {item.trailing && (
            <div className="shrink-0">{item.trailing}</div>
          )}
        </div>
      ))}
    </div>
  );
}
