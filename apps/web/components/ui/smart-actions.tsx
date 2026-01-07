/**
 * Smart Actions System
 * 
 * Contextual, intelligent actions that adapt to the user's current context
 */

'use client';

import React, { memo, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  LucideIcon,
  Search,
  FileText,
  BarChart3,
  Bell,
  Download,
  Upload,
  Plus,
  RefreshCw,
  Settings,
  Filter,
  Calendar,
  DollarSign,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Sparkles,
  Zap,
  Target,
  Shield,
  Briefcase,
  PieChart,
  LineChart,
  Activity,
  MessageSquare,
  Share2,
  Bookmark,
  Star,
  Eye,
  Edit,
  Trash2,
  Copy,
  Link,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Command,
  Keyboard,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export interface SmartAction {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  action: () => void;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  shortcut?: string;
  badge?: string | number;
  disabled?: boolean;
  loading?: boolean;
  hidden?: boolean;
}

export interface ActionGroup {
  id: string;
  label: string;
  actions: SmartAction[];
  collapsed?: boolean;
}

export type ContextType = 
  | 'dashboard'
  | 'contracts-list'
  | 'contract-detail'
  | 'supplier-detail'
  | 'analytics'
  | 'settings'
  | 'search'
  | 'workflow'
  | 'default';

// =============================================================================
// ACTION PRESETS
// =============================================================================

export const getContextualActions = (
  context: ContextType,
  handlers: Record<string, () => void>,
  data?: Record<string, unknown>
): SmartAction[] => {
  const baseActions: Record<ContextType, SmartAction[]> = {
    dashboard: [
      {
        id: 'quick-search',
        label: 'Quick Search',
        description: 'Search contracts, suppliers, and more',
        icon: Search,
        action: handlers.search || (() => {}),
        shortcut: '⌘K',
        variant: 'primary',
      },
      {
        id: 'expiring-contracts',
        label: 'Expiring Soon',
        description: 'View contracts expiring in 30 days',
        icon: Clock,
        action: handlers.viewExpiring || (() => {}),
        badge: data?.expiringCount as number,
        variant: data?.expiringCount ? 'warning' : 'default',
      },
      {
        id: 'needs-attention',
        label: 'Needs Attention',
        description: 'Contracts requiring action',
        icon: AlertTriangle,
        action: handlers.viewAttention || (() => {}),
        badge: data?.attentionCount as number,
        variant: data?.attentionCount ? 'danger' : 'default',
      },
      {
        id: 'analytics',
        label: 'View Analytics',
        icon: BarChart3,
        action: handlers.viewAnalytics || (() => {}),
      },
      {
        id: 'upload',
        label: 'Upload Contract',
        icon: Upload,
        action: handlers.upload || (() => {}),
        shortcut: '⌘U',
      },
    ],
    'contracts-list': [
      {
        id: 'new-contract',
        label: 'New Contract',
        icon: Plus,
        action: handlers.create || (() => {}),
        variant: 'primary',
        shortcut: '⌘N',
      },
      {
        id: 'filter',
        label: 'Filter',
        icon: Filter,
        action: handlers.filter || (() => {}),
        shortcut: '⌘F',
      },
      {
        id: 'export',
        label: 'Export',
        icon: Download,
        action: handlers.export || (() => {}),
      },
      {
        id: 'refresh',
        label: 'Refresh',
        icon: RefreshCw,
        action: handlers.refresh || (() => {}),
        shortcut: '⌘R',
      },
      {
        id: 'bulk-actions',
        label: 'Bulk Actions',
        icon: Settings,
        action: handlers.bulkActions || (() => {}),
      },
    ],
    'contract-detail': [
      {
        id: 'edit',
        label: 'Edit Contract',
        icon: Edit,
        action: handlers.edit || (() => {}),
        variant: 'primary',
        shortcut: 'E',
      },
      {
        id: 'download',
        label: 'Download PDF',
        icon: Download,
        action: handlers.download || (() => {}),
      },
      {
        id: 'share',
        label: 'Share',
        icon: Share2,
        action: handlers.share || (() => {}),
      },
      {
        id: 'renew',
        label: 'Start Renewal',
        icon: RefreshCw,
        action: handlers.renew || (() => {}),
        variant: 'success',
      },
      {
        id: 'ai-analyze',
        label: 'AI Analysis',
        icon: Sparkles,
        action: handlers.aiAnalyze || (() => {}),
      },
      {
        id: 'bookmark',
        label: 'Bookmark',
        icon: Bookmark,
        action: handlers.bookmark || (() => {}),
      },
    ],
    'supplier-detail': [
      {
        id: 'view-contracts',
        label: 'View All Contracts',
        icon: FileText,
        action: handlers.viewContracts || (() => {}),
        variant: 'primary',
      },
      {
        id: 'spend-analysis',
        label: 'Spend Analysis',
        icon: DollarSign,
        action: handlers.spendAnalysis || (() => {}),
      },
      {
        id: 'risk-assessment',
        label: 'Risk Assessment',
        icon: Shield,
        action: handlers.riskAssessment || (() => {}),
      },
      {
        id: 'contact',
        label: 'Contact Supplier',
        icon: MessageSquare,
        action: handlers.contact || (() => {}),
      },
    ],
    analytics: [
      {
        id: 'refresh-data',
        label: 'Refresh Data',
        icon: RefreshCw,
        action: handlers.refresh || (() => {}),
      },
      {
        id: 'export-report',
        label: 'Export Report',
        icon: Download,
        action: handlers.exportReport || (() => {}),
        variant: 'primary',
      },
      {
        id: 'schedule-report',
        label: 'Schedule Report',
        icon: Calendar,
        action: handlers.scheduleReport || (() => {}),
      },
      {
        id: 'drill-down',
        label: 'Drill Down',
        icon: Target,
        action: handlers.drillDown || (() => {}),
      },
    ],
    settings: [
      {
        id: 'save',
        label: 'Save Changes',
        icon: CheckCircle2,
        action: handlers.save || (() => {}),
        variant: 'primary',
        shortcut: '⌘S',
      },
      {
        id: 'reset',
        label: 'Reset to Default',
        icon: RefreshCw,
        action: handlers.reset || (() => {}),
      },
    ],
    search: [
      {
        id: 'advanced-search',
        label: 'Advanced Search',
        icon: Filter,
        action: handlers.advancedSearch || (() => {}),
      },
      {
        id: 'save-search',
        label: 'Save Search',
        icon: Bookmark,
        action: handlers.saveSearch || (() => {}),
      },
      {
        id: 'export-results',
        label: 'Export Results',
        icon: Download,
        action: handlers.exportResults || (() => {}),
      },
    ],
    workflow: [
      {
        id: 'approve',
        label: 'Approve',
        icon: CheckCircle2,
        action: handlers.approve || (() => {}),
        variant: 'success',
      },
      {
        id: 'reject',
        label: 'Reject',
        icon: AlertTriangle,
        action: handlers.reject || (() => {}),
        variant: 'danger',
      },
      {
        id: 'request-changes',
        label: 'Request Changes',
        icon: Edit,
        action: handlers.requestChanges || (() => {}),
      },
      {
        id: 'add-comment',
        label: 'Add Comment',
        icon: MessageSquare,
        action: handlers.addComment || (() => {}),
      },
    ],
    default: [
      {
        id: 'help',
        label: 'Help',
        icon: MessageSquare,
        action: handlers.help || (() => {}),
        shortcut: '?',
      },
      {
        id: 'shortcuts',
        label: 'Keyboard Shortcuts',
        icon: Keyboard,
        action: handlers.shortcuts || (() => {}),
        shortcut: '⌘/',
      },
    ],
  };

  return baseActions[context] || baseActions.default;
};

// =============================================================================
// QUICK ACTIONS BAR
// =============================================================================

interface QuickActionsBarProps {
  actions: SmartAction[];
  className?: string;
  position?: 'top' | 'bottom' | 'inline';
  maxVisible?: number;
}

export const QuickActionsBar = memo<QuickActionsBarProps>(({
  actions,
  className,
  position = 'bottom',
  maxVisible = 5,
}) => {
  const [expanded, setExpanded] = useState(false);
  
  const visibleActions = useMemo(() => 
    actions.filter(a => !a.hidden).slice(0, expanded ? actions.length : maxVisible),
    [actions, expanded, maxVisible]
  );
  
  const hasMore = actions.filter(a => !a.hidden).length > maxVisible;
  
  const positionClasses = {
    top: 'fixed top-4 left-1/2 -translate-x-1/2 z-50',
    bottom: 'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
    inline: '',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: position === 'bottom' ? 20 : -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: position === 'bottom' ? 20 : -20 }}
      className={cn(
        'flex items-center gap-2 p-2 rounded-xl',
        'bg-background/80 backdrop-blur-lg border shadow-lg',
        positionClasses[position],
        className
      )}
    >
      <AnimatePresence mode="popLayout">
        {visibleActions.map((action, index) => (
          <motion.button
            key={action.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ delay: index * 0.05 }}
            onClick={action.action}
            disabled={action.disabled || action.loading}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
              'transition-colors duration-200',
              action.variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
              action.variant === 'success' && 'bg-green-500 text-white hover:bg-green-600',
              action.variant === 'warning' && 'bg-amber-500 text-white hover:bg-amber-600',
              action.variant === 'danger' && 'bg-red-500 text-white hover:bg-red-600',
              !action.variant && 'hover:bg-muted',
              action.disabled && 'opacity-50 cursor-not-allowed',
            )}
            title={action.description}
          >
            {action.loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <action.icon className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">{action.label}</span>
            {action.badge && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-background/20">
                {action.badge}
              </span>
            )}
            {action.shortcut && (
              <kbd className="hidden md:inline ml-2 px-1.5 py-0.5 text-[10px] rounded bg-background/20">
                {action.shortcut}
              </kbd>
            )}
          </motion.button>
        ))}
      </AnimatePresence>
      
      {hasMore && (
        <motion.button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 px-2 py-2 rounded-lg hover:bg-muted text-muted-foreground"
        >
          <MoreHorizontal className="h-4 w-4" />
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-3 w-3" />
          </motion.span>
        </motion.button>
      )}
    </motion.div>
  );
});
QuickActionsBar.displayName = 'QuickActionsBar';

// =============================================================================
// ACTION CHIP
// =============================================================================

interface ActionChipProps {
  action: SmartAction;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ActionChip = memo<ActionChipProps>(({
  action,
  size = 'md',
  className,
}) => {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs gap-1',
    md: 'px-3 py-1.5 text-sm gap-1.5',
    lg: 'px-4 py-2 text-base gap-2',
  };
  
  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={action.action}
      disabled={action.disabled || action.loading}
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        'transition-colors duration-200',
        sizeClasses[size],
        action.variant === 'primary' && 'bg-primary/10 text-primary hover:bg-primary/20',
        action.variant === 'success' && 'bg-green-500/10 text-green-600 hover:bg-green-500/20',
        action.variant === 'warning' && 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20',
        action.variant === 'danger' && 'bg-red-500/10 text-red-600 hover:bg-red-500/20',
        !action.variant && 'bg-muted hover:bg-muted/80',
        action.disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {action.loading ? (
        <RefreshCw className={cn(iconSizes[size], 'animate-spin')} />
      ) : (
        <action.icon className={iconSizes[size]} />
      )}
      <span>{action.label}</span>
      {action.badge && (
        <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-background/50">
          {action.badge}
        </span>
      )}
    </motion.button>
  );
});
ActionChip.displayName = 'ActionChip';

// =============================================================================
// COMMAND PALETTE
// =============================================================================

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  actions: SmartAction[];
  recentActions?: string[];
}

export const CommandPalette = memo<CommandPaletteProps>(({
  isOpen,
  onClose,
  actions,
  recentActions = [],
}) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const filteredActions = useMemo(() => {
    const query = search.toLowerCase();
    return actions.filter(a => 
      !a.hidden && (
        a.label.toLowerCase().includes(query) ||
        a.description?.toLowerCase().includes(query)
      )
    );
  }, [actions, search]);
  
  const recentFilteredActions = useMemo(() => {
    return filteredActions.filter(a => recentActions.includes(a.id));
  }, [filteredActions, recentActions]);
  
  const otherActions = useMemo(() => {
    return filteredActions.filter(a => !recentActions.includes(a.id));
  }, [filteredActions, recentActions]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filteredActions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const action = filteredActions[selectedIndex];
      if (action && !action.disabled) {
        action.action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filteredActions, selectedIndex, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg"
          >
            <div className="bg-popover border rounded-xl shadow-2xl overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Type a command or search..."
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value);
                    setSelectedIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  autoFocus
                />
                <kbd className="px-2 py-1 text-xs rounded bg-muted text-muted-foreground">
                  ESC
                </kbd>
              </div>
              
              {/* Results */}
              <div className="max-h-[300px] overflow-y-auto p-2">
                {recentFilteredActions.length > 0 && (
                  <div className="mb-2">
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                      Recent
                    </div>
                    {recentFilteredActions.map((action, idx) => (
                      <CommandItem
                        key={action.id}
                        action={action}
                        isSelected={idx === selectedIndex}
                        onClick={() => {
                          action.action();
                          onClose();
                        }}
                      />
                    ))}
                  </div>
                )}
                
                {otherActions.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                      Actions
                    </div>
                    {otherActions.map((action, idx) => (
                      <CommandItem
                        key={action.id}
                        action={action}
                        isSelected={idx + recentFilteredActions.length === selectedIndex}
                        onClick={() => {
                          action.action();
                          onClose();
                        }}
                      />
                    ))}
                  </div>
                )}
                
                {filteredActions.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No matching commands
                  </div>
                )}
              </div>
              
              {/* Footer */}
              <div className="flex items-center gap-4 px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted">↑</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted">↓</kbd>
                  to navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted">↵</kbd>
                  to select
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});
CommandPalette.displayName = 'CommandPalette';

// Command Item
const CommandItem = memo<{
  action: SmartAction;
  isSelected: boolean;
  onClick: () => void;
}>(({ action, isSelected, onClick }) => (
  <button
    onClick={onClick}
    disabled={action.disabled}
    className={cn(
      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left',
      'transition-colors duration-150',
      isSelected ? 'bg-accent' : 'hover:bg-accent/50',
      action.disabled && 'opacity-50 cursor-not-allowed',
    )}
  >
    <div className={cn(
      'flex items-center justify-center h-8 w-8 rounded-lg',
      action.variant === 'primary' && 'bg-primary/10 text-primary',
      action.variant === 'success' && 'bg-green-500/10 text-green-600',
      action.variant === 'warning' && 'bg-amber-500/10 text-amber-600',
      action.variant === 'danger' && 'bg-red-500/10 text-red-600',
      !action.variant && 'bg-muted',
    )}>
      <action.icon className="h-4 w-4" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium truncate">{action.label}</div>
      {action.description && (
        <div className="text-xs text-muted-foreground truncate">{action.description}</div>
      )}
    </div>
    {action.shortcut && (
      <kbd className="px-2 py-1 text-xs rounded bg-muted text-muted-foreground">
        {action.shortcut}
      </kbd>
    )}
    {action.badge && (
      <span className="px-2 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
        {action.badge}
      </span>
    )}
  </button>
));
CommandItem.displayName = 'CommandItem';

// =============================================================================
// FAB (Floating Action Button)
// =============================================================================

interface FABProps {
  icon: LucideIcon;
  label?: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  position?: 'bottom-right' | 'bottom-left';
  className?: string;
}

export const FAB = memo<FABProps>(({
  icon: Icon,
  label,
  onClick,
  variant = 'primary',
  position = 'bottom-right',
  className,
}) => {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        'fixed z-40 flex items-center gap-2 rounded-full shadow-lg',
        'transition-colors duration-200',
        position === 'bottom-right' && 'right-6 bottom-6',
        position === 'bottom-left' && 'left-6 bottom-6',
        variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
        variant === 'secondary' && 'bg-secondary text-secondary-foreground hover:bg-secondary/90',
        label ? 'px-5 py-3' : 'p-4',
        className
      )}
    >
      <Icon className="h-5 w-5" />
      {label && <span className="font-medium">{label}</span>}
    </motion.button>
  );
});
FAB.displayName = 'FAB';

// =============================================================================
// EXPORTS
// =============================================================================

export default QuickActionsBar;
