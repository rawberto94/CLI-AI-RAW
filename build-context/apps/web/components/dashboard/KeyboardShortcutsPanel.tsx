'use client';

/**
 * Keyboard Shortcuts Panel
 * 
 * A modal/panel showing all available keyboard shortcuts with search
 * and categorization. Can be triggered with Cmd+K or ? key.
 */

import React, { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  Keyboard,
  FileText,
  LayoutDashboard,
  Settings,
  Navigation,
  Edit,
  Eye,
  Command,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CornerDownLeft,
} from 'lucide-react';

// ============ Types ============

export interface KeyboardShortcut {
  id: string;
  keys: string[];
  description: string;
  category: ShortcutCategory;
  action?: () => void;
  global?: boolean;
}

export type ShortcutCategory = 
  | 'navigation'
  | 'contracts'
  | 'editing'
  | 'view'
  | 'actions'
  | 'search'
  | 'general';

interface KeyboardShortcutsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts?: KeyboardShortcut[];
  onShortcutExecute?: (shortcut: KeyboardShortcut) => void;
}

// ============ Configuration ============

const categoryConfig: Record<ShortcutCategory, { icon: React.ElementType; label: string; color: string }> = {
  navigation: { icon: Navigation, label: 'Navigation', color: 'text-violet-500' },
  contracts: { icon: FileText, label: 'Contracts', color: 'text-violet-500' },
  editing: { icon: Edit, label: 'Editing', color: 'text-orange-500' },
  view: { icon: Eye, label: 'View', color: 'text-violet-500' },
  actions: { icon: Command, label: 'Actions', color: 'text-red-500' },
  search: { icon: Search, label: 'Search', color: 'text-violet-500' },
  general: { icon: Settings, label: 'General', color: 'text-slate-500' },
};

// Default shortcuts
const defaultShortcuts: KeyboardShortcut[] = [
  // Navigation
  { id: 'go-dashboard', keys: ['g', 'd'], description: 'Go to Dashboard', category: 'navigation', global: true },
  { id: 'go-contracts', keys: ['g', 'c'], description: 'Go to Contracts', category: 'navigation', global: true },
  { id: 'go-analytics', keys: ['g', 'a'], description: 'Go to Analytics', category: 'navigation', global: true },
  { id: 'go-settings', keys: ['g', 's'], description: 'Go to Settings', category: 'navigation', global: true },
  { id: 'go-back', keys: ['⌘', '['], description: 'Go back', category: 'navigation', global: true },
  { id: 'go-forward', keys: ['⌘', ']'], description: 'Go forward', category: 'navigation', global: true },
  
  // Contracts
  { id: 'new-contract', keys: ['n'], description: 'New contract upload', category: 'contracts' },
  { id: 'compare-contracts', keys: ['⌘', 'k'], description: 'Compare contracts', category: 'contracts' },
  { id: 'export-contract', keys: ['⌘', 'e'], description: 'Export contract', category: 'contracts' },
  { id: 'favorite-contract', keys: ['f'], description: 'Toggle favorite', category: 'contracts' },
  { id: 'archive-contract', keys: ['a'], description: 'Archive contract', category: 'contracts' },
  { id: 'delete-contract', keys: ['⌘', '⌫'], description: 'Delete contract', category: 'contracts' },
  
  // View
  { id: 'toggle-sidebar', keys: ['⌘', 'b'], description: 'Toggle sidebar', category: 'view', global: true },
  { id: 'toggle-fullscreen', keys: ['⌘', '⏎'], description: 'Toggle fullscreen', category: 'view' },
  { id: 'zoom-in', keys: ['⌘', '+'], description: 'Zoom in', category: 'view' },
  { id: 'zoom-out', keys: ['⌘', '-'], description: 'Zoom out', category: 'view' },
  { id: 'reset-zoom', keys: ['⌘', '0'], description: 'Reset zoom', category: 'view' },
  { id: 'toggle-grid', keys: ['⌘', 'g'], description: 'Toggle grid view', category: 'view' },
  
  // Editing
  { id: 'edit-mode', keys: ['e'], description: 'Enter edit mode', category: 'editing' },
  { id: 'save', keys: ['⌘', 's'], description: 'Save changes', category: 'editing' },
  { id: 'undo', keys: ['⌘', 'z'], description: 'Undo', category: 'editing' },
  { id: 'redo', keys: ['⌘', '⇧', 'z'], description: 'Redo', category: 'editing' },
  { id: 'copy', keys: ['⌘', 'c'], description: 'Copy', category: 'editing' },
  { id: 'paste', keys: ['⌘', 'v'], description: 'Paste', category: 'editing' },
  
  // Search
  { id: 'global-search', keys: ['⌘', 'k'], description: 'Open global search', category: 'search', global: true },
  { id: 'search-contracts', keys: ['/'], description: 'Search contracts', category: 'search' },
  { id: 'filter', keys: ['⌘', 'f'], description: 'Open filters', category: 'search' },
  { id: 'clear-filters', keys: ['⌘', '⇧', 'f'], description: 'Clear all filters', category: 'search' },
  { id: 'next-result', keys: ['⌘', 'g'], description: 'Next search result', category: 'search' },
  { id: 'prev-result', keys: ['⌘', '⇧', 'g'], description: 'Previous search result', category: 'search' },
  
  // Actions
  { id: 'quick-actions', keys: ['⌘', '.'], description: 'Open quick actions', category: 'actions' },
  { id: 'ai-assistant', keys: ['⌘', 'j'], description: 'Open AI assistant', category: 'actions', global: true },
  { id: 'notifications', keys: ['⌘', 'n'], description: 'Toggle notifications', category: 'actions', global: true },
  { id: 'help', keys: ['?'], description: 'Show keyboard shortcuts', category: 'actions', global: true },
  { id: 'refresh', keys: ['⌘', 'r'], description: 'Refresh data', category: 'actions' },
  
  // General
  { id: 'escape', keys: ['Esc'], description: 'Close modal / Cancel', category: 'general', global: true },
  { id: 'select-all', keys: ['⌘', 'a'], description: 'Select all', category: 'general' },
  { id: 'deselect', keys: ['Esc'], description: 'Deselect all', category: 'general' },
  { id: 'move-up', keys: ['↑'], description: 'Move selection up', category: 'general' },
  { id: 'move-down', keys: ['↓'], description: 'Move selection down', category: 'general' },
  { id: 'confirm', keys: ['⏎'], description: 'Confirm / Open', category: 'general' },
];

// ============ Sub-components ============

const KeyBadge = memo(function KeyBadge({ keyName }: { keyName: string }) {
  // Map special keys to icons or styled display
  const keyDisplay = useMemo(() => {
    switch (keyName) {
      case '⌘': return <Command className="h-3 w-3" />;
      case '⇧': return 'Shift';
      case '⌃': return 'Ctrl';
      case '⌥': return 'Alt';
      case '⏎': return <CornerDownLeft className="h-3 w-3" />;
      case '⌫': return 'Del';
      case '↑': return <ArrowUp className="h-3 w-3" />;
      case '↓': return <ArrowDown className="h-3 w-3" />;
      case '←': return <ArrowLeft className="h-3 w-3" />;
      case '→': return <ArrowRight className="h-3 w-3" />;
      case 'Esc': return 'Esc';
      default: return keyName.toUpperCase();
    }
  }, [keyName]);

  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-medium bg-muted border border-border rounded shadow-sm">
      {keyDisplay}
    </kbd>
  );
});

const ShortcutItem = memo(function ShortcutItem({
  shortcut,
  onExecute,
}: {
  shortcut: KeyboardShortcut;
  onExecute?: (shortcut: KeyboardShortcut) => void;
}) {
  const config = categoryConfig[shortcut.category];
  
  return (
    <motion.button
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left group"
      onClick={() => onExecute?.(shortcut)}
    >
      <div className="flex items-center gap-3">
        <config.icon className={`h-4 w-4 ${config.color} opacity-60`} />
        <span className="text-sm">{shortcut.description}</span>
        {shortcut.global && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 opacity-60">
            Global
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1">
        {shortcut.keys.map((key, i) => (
          <React.Fragment key={i}>
            <KeyBadge keyName={key} />
            {i < shortcut.keys.length - 1 && (
              <span className="text-muted-foreground text-xs mx-0.5">+</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </motion.button>
  );
});

const CategorySection = memo(function CategorySection({
  category,
  shortcuts,
  onExecute,
}: {
  category: ShortcutCategory;
  shortcuts: KeyboardShortcut[];
  onExecute?: (shortcut: KeyboardShortcut) => void;
}) {
  const config = categoryConfig[category];
  
  if (shortcuts.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2 px-2">
        <config.icon className={`h-4 w-4 ${config.color}`} />
        <h3 className="text-sm font-medium text-muted-foreground">{config.label}</h3>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
          {shortcuts.length}
        </Badge>
      </div>
      <div className="space-y-0.5">
        {shortcuts.map((shortcut) => (
          <ShortcutItem
            key={shortcut.id}
            shortcut={shortcut}
            onExecute={onExecute}
          />
        ))}
      </div>
    </div>
  );
});

// ============ Main Component ============

export function KeyboardShortcutsPanel({
  open,
  onOpenChange,
  shortcuts = defaultShortcuts,
  onShortcutExecute,
}: KeyboardShortcutsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Reset search when closed
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
    }
  }, [open]);

  // Filter shortcuts based on search
  const filteredShortcuts = useMemo(() => {
    if (!searchQuery.trim()) return shortcuts;
    
    const query = searchQuery.toLowerCase();
    return shortcuts.filter(s => 
      s.description.toLowerCase().includes(query) ||
      s.keys.some(k => k.toLowerCase().includes(query)) ||
      categoryConfig[s.category].label.toLowerCase().includes(query)
    );
  }, [shortcuts, searchQuery]);

  // Group by category
  const groupedShortcuts = useMemo(() => {
    const groups: Record<ShortcutCategory, KeyboardShortcut[]> = {
      navigation: [],
      contracts: [],
      editing: [],
      view: [],
      actions: [],
      search: [],
      general: [],
    };
    
    filteredShortcuts.forEach(s => {
      groups[s.category].push(s);
    });
    
    return groups;
  }, [filteredShortcuts]);

  const handleExecute = useCallback((shortcut: KeyboardShortcut) => {
    if (shortcut.action) {
      shortcut.action();
    }
    onShortcutExecute?.(shortcut);
    onOpenChange(false);
  }, [onShortcutExecute, onOpenChange]);

  // Global keyboard listener for ? key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open on ? key when not in an input
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        onOpenChange(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search shortcuts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        {/* Shortcuts list */}
        <ScrollArea className="flex-1 max-h-[calc(80vh-140px)]">
          <div className="p-4">
            {filteredShortcuts.length === 0 ? (
              <div className="text-center py-8">
                <Keyboard className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No shortcuts found</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Try a different search term
                </p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
                  <CategorySection
                    key={category}
                    category={category as ShortcutCategory}
                    shortcuts={categoryShortcuts}
                    onExecute={handleExecute}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <KeyBadge keyName="↑" />
              <KeyBadge keyName="↓" />
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <KeyBadge keyName="⏎" />
              Execute
            </span>
            <span className="flex items-center gap-1">
              <KeyBadge keyName="Esc" />
              Close
            </span>
          </div>
          <span>{filteredShortcuts.length} shortcuts</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============ Hook for Global Shortcuts ============

export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  enabled: boolean = true
) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const keySequence: string[] = [];
    let sequenceTimeout: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if in input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // Build key representation
      const key = e.key.toLowerCase();
      const modifiers = [];
      if (e.metaKey || e.ctrlKey) modifiers.push('⌘');
      if (e.shiftKey) modifiers.push('⇧');
      if (e.altKey) modifiers.push('⌥');

      // Clear sequence after delay
      clearTimeout(sequenceTimeout);
      sequenceTimeout = setTimeout(() => {
        keySequence.length = 0;
      }, 500);

      // Add to sequence
      const keyCombo = [...modifiers, key].join('+');
      keySequence.push(keyCombo);

      // Check for matches
      for (const shortcut of shortcuts) {
        const shortcutKeys = shortcut.keys.map(k => k.toLowerCase()).join('+');
        const currentSequence = keySequence.join('+');

        if (shortcutKeys === currentSequence || shortcutKeys === keyCombo) {
          e.preventDefault();
          shortcut.action?.();
          keySequence.length = 0;
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(sequenceTimeout);
    };
  }, [shortcuts, enabled]);

  return { isOpen, setIsOpen };
}

// ============ Exports ============

export { defaultShortcuts };
export default memo(KeyboardShortcutsPanel);
