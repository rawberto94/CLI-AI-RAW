'use client';

import React, { useState, useRef, useEffect, createContext, useContext, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, Copy, Trash2, Edit, Download, Share2,
  Eye, EyeOff, Star, StarOff, Pin, PinOff, Archive,
  MoreHorizontal, Scissors, Clipboard, RefreshCw, ExternalLink
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  onClick?: () => void;
  submenu?: ContextMenuItem[];
}

interface ContextMenuPosition {
  x: number;
  y: number;
}

interface ContextMenuState {
  isOpen: boolean;
  position: ContextMenuPosition;
  items: ContextMenuItem[];
  targetElement?: HTMLElement;
}

interface ContextMenuContextValue {
  show: (items: ContextMenuItem[], position: ContextMenuPosition, target?: HTMLElement) => void;
  hide: () => void;
}

// ============================================================================
// Context
// ============================================================================

const ContextMenuContext = createContext<ContextMenuContextValue | null>(null);

export function useContextMenu() {
  const context = useContext(ContextMenuContext);
  if (!context) {
    throw new Error('useContextMenu must be used within ContextMenuProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface ContextMenuProviderProps {
  children: React.ReactNode;
}

export function ContextMenuProvider({ children }: ContextMenuProviderProps) {
  const [state, setState] = useState<ContextMenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    items: [],
  });

  const show = useCallback((items: ContextMenuItem[], position: ContextMenuPosition, target?: HTMLElement) => {
    // Adjust position to keep menu in viewport
    const menuWidth = 220;
    const menuHeight = items.length * 36 + 16;
    
    let { x, y } = position;
    
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 16;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 16;
    }

    setState({
      isOpen: true,
      position: { x, y },
      items,
      targetElement: target,
    });
  }, []);

  const hide = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClick = () => {
      if (state.isOpen) hide();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.isOpen) hide();
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.isOpen, hide]);

  return (
    <ContextMenuContext.Provider value={{ show, hide }}>
      {children}
      <AnimatePresence>
        {state.isOpen && (
          <ContextMenuPopup
            items={state.items}
            position={state.position}
            onClose={hide}
          />
        )}
      </AnimatePresence>
    </ContextMenuContext.Provider>
  );
}

// ============================================================================
// Context Menu Popup
// ============================================================================

interface ContextMenuPopupProps {
  items: ContextMenuItem[];
  position: ContextMenuPosition;
  onClose: () => void;
}

function ContextMenuPopup({ items, position, onClose }: ContextMenuPopupProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.1 }}
      style={{ left: position.x, top: position.y }}
      className="fixed z-[200] min-w-[200px] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          {index > 0 && item.id.startsWith('divider') && (
            <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
          )}
          <ContextMenuItemComponent item={item} onClose={onClose} />
        </React.Fragment>
      ))}
    </motion.div>
  );
}

// ============================================================================
// Context Menu Item
// ============================================================================

interface ContextMenuItemComponentProps {
  item: ContextMenuItem;
  onClose: () => void;
}

function ContextMenuItemComponent({ item, onClose }: ContextMenuItemComponentProps) {
  const [showSubmenu, setShowSubmenu] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  if (item.id.startsWith('divider')) {
    return null;
  }

  const handleClick = () => {
    if (item.disabled) return;
    if (item.submenu) return;
    
    item.onClick?.();
    onClose();
  };

  return (
    <div
      ref={itemRef}
      className="relative"
      onMouseEnter={() => item.submenu && setShowSubmenu(true)}
      onMouseLeave={() => item.submenu && setShowSubmenu(false)}
    >
      <button
        onClick={handleClick}
        disabled={item.disabled}
        className={`
          w-full px-3 py-2 flex items-center gap-3 text-sm
          ${item.disabled 
            ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' 
            : item.danger 
            ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }
          transition-colors
        `}
      >
        {item.icon && (
          <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>
        )}
        <span className="flex-1 text-left">{item.label}</span>
        {item.shortcut && (
          <span className="text-xs text-gray-400 dark:text-gray-600 font-mono">
            {item.shortcut}
          </span>
        )}
        {item.submenu && (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Submenu */}
      <AnimatePresence>
        {showSubmenu && item.submenu && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="absolute left-full top-0 ml-1 min-w-[180px] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2"
          >
            {item.submenu.map(subItem => (
              <ContextMenuItemComponent
                key={subItem.id}
                item={subItem}
                onClose={onClose}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Context Menu Trigger
// ============================================================================

interface ContextMenuTriggerProps {
  children: React.ReactNode;
  items: ContextMenuItem[];
  disabled?: boolean;
}

export function ContextMenuTrigger({
  children,
  items,
  disabled = false,
}: ContextMenuTriggerProps) {
  const { show } = useContextMenu();

  const handleContextMenu = (e: React.MouseEvent) => {
    if (disabled) return;
    
    e.preventDefault();
    show(items, { x: e.clientX, y: e.clientY }, e.currentTarget as HTMLElement);
  };

  return (
    <div onContextMenu={handleContextMenu}>
      {children}
    </div>
  );
}

// ============================================================================
// Dropdown Menu (click-triggered)
// ============================================================================

interface DropdownMenuProps {
  items: ContextMenuItem[];
  trigger?: React.ReactNode;
  position?: 'left' | 'right';
  className?: string;
}

export function DropdownMenu({
  items,
  trigger,
  position = 'right',
  className = '',
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleClick);
    }

    return () => document.removeEventListener('click', handleClick);
  }, [isOpen]);

  return (
    <div ref={menuRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        {trigger || <MoreHorizontal className="w-5 h-5" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className={`
              absolute z-50 mt-2 min-w-[180px] bg-white dark:bg-gray-900 
              rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2
              ${position === 'right' ? 'right-0' : 'left-0'}
            `}
          >
            {items.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && item.id.startsWith('divider') && (
                  <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
                )}
                {!item.id.startsWith('divider') && (
                  <button
                    onClick={() => {
                      if (!item.disabled) {
                        item.onClick?.();
                        setIsOpen(false);
                      }
                    }}
                    disabled={item.disabled}
                    className={`
                      w-full px-3 py-2 flex items-center gap-3 text-sm
                      ${item.disabled 
                        ? 'text-gray-400 cursor-not-allowed' 
                        : item.danger 
                        ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }
                      transition-colors
                    `}
                  >
                    {item.icon && <span className="w-4 h-4">{item.icon}</span>}
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.shortcut && (
                      <span className="text-xs text-gray-400 font-mono">
                        {item.shortcut}
                      </span>
                    )}
                  </button>
                )}
              </React.Fragment>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Preset Menu Items
// ============================================================================

export function createFileMenuItems(options: {
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
  onRename?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  onOpenInNewTab?: () => void;
}): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];

  if (options.onOpenInNewTab) {
    items.push({
      id: 'open-new-tab',
      label: 'Open in New Tab',
      icon: <ExternalLink className="w-4 h-4" />,
      onClick: options.onOpenInNewTab,
    });
  }

  if (options.onCopy || options.onCut || options.onPaste) {
    if (items.length > 0) items.push({ id: 'divider-1', label: '' });

    if (options.onCut) {
      items.push({
        id: 'cut',
        label: 'Cut',
        icon: <Scissors className="w-4 h-4" />,
        shortcut: '⌘X',
        onClick: options.onCut,
      });
    }

    if (options.onCopy) {
      items.push({
        id: 'copy',
        label: 'Copy',
        icon: <Copy className="w-4 h-4" />,
        shortcut: '⌘C',
        onClick: options.onCopy,
      });
    }

    if (options.onPaste) {
      items.push({
        id: 'paste',
        label: 'Paste',
        icon: <Clipboard className="w-4 h-4" />,
        shortcut: '⌘V',
        onClick: options.onPaste,
      });
    }
  }

  if (options.onRename || options.onDownload || options.onShare) {
    if (items.length > 0) items.push({ id: 'divider-2', label: '' });

    if (options.onRename) {
      items.push({
        id: 'rename',
        label: 'Rename',
        icon: <Edit className="w-4 h-4" />,
        onClick: options.onRename,
      });
    }

    if (options.onDownload) {
      items.push({
        id: 'download',
        label: 'Download',
        icon: <Download className="w-4 h-4" />,
        onClick: options.onDownload,
      });
    }

    if (options.onShare) {
      items.push({
        id: 'share',
        label: 'Share',
        icon: <Share2 className="w-4 h-4" />,
        onClick: options.onShare,
      });
    }
  }

  if (options.onDelete) {
    if (items.length > 0) items.push({ id: 'divider-3', label: '' });

    items.push({
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 className="w-4 h-4" />,
      danger: true,
      onClick: options.onDelete,
    });
  }

  return items;
}

export function createItemMenuItems(options: {
  onEdit?: () => void;
  onDuplicate?: () => void;
  onArchive?: () => void;
  onStar?: () => void;
  isStarred?: boolean;
  onPin?: () => void;
  isPinned?: boolean;
  onHide?: () => void;
  isHidden?: boolean;
  onRefresh?: () => void;
  onDelete?: () => void;
}): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];

  if (options.onEdit) {
    items.push({
      id: 'edit',
      label: 'Edit',
      icon: <Edit className="w-4 h-4" />,
      onClick: options.onEdit,
    });
  }

  if (options.onDuplicate) {
    items.push({
      id: 'duplicate',
      label: 'Duplicate',
      icon: <Copy className="w-4 h-4" />,
      onClick: options.onDuplicate,
    });
  }

  if (options.onStar || options.onPin) {
    if (items.length > 0) items.push({ id: 'divider-1', label: '' });

    if (options.onStar) {
      items.push({
        id: 'star',
        label: options.isStarred ? 'Remove Star' : 'Add Star',
        icon: options.isStarred ? <StarOff className="w-4 h-4" /> : <Star className="w-4 h-4" />,
        onClick: options.onStar,
      });
    }

    if (options.onPin) {
      items.push({
        id: 'pin',
        label: options.isPinned ? 'Unpin' : 'Pin',
        icon: options.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />,
        onClick: options.onPin,
      });
    }
  }

  if (options.onHide || options.onArchive) {
    if (items.length > 0) items.push({ id: 'divider-2', label: '' });

    if (options.onHide) {
      items.push({
        id: 'hide',
        label: options.isHidden ? 'Show' : 'Hide',
        icon: options.isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />,
        onClick: options.onHide,
      });
    }

    if (options.onArchive) {
      items.push({
        id: 'archive',
        label: 'Archive',
        icon: <Archive className="w-4 h-4" />,
        onClick: options.onArchive,
      });
    }
  }

  if (options.onRefresh) {
    if (items.length > 0) items.push({ id: 'divider-3', label: '' });

    items.push({
      id: 'refresh',
      label: 'Refresh',
      icon: <RefreshCw className="w-4 h-4" />,
      onClick: options.onRefresh,
    });
  }

  if (options.onDelete) {
    if (items.length > 0) items.push({ id: 'divider-4', label: '' });

    items.push({
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 className="w-4 h-4" />,
      danger: true,
      onClick: options.onDelete,
    });
  }

  return items;
}
