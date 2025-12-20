'use client';

/**
 * Contextual Action Bar
 * Floating action bar that appears on specific pages with relevant quick actions
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Upload, 
  Search, 
  MessageSquare, 
  Download, 
  Share2, 
  Filter,
  Plus,
  Sparkles,
  FileText,
  BarChart3,
  RefreshCw,
  Settings,
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  onClick?: () => void;
  href?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning';
  disabled?: boolean;
  tooltip?: string;
}

interface PageActionConfig {
  match: RegExp | string;
  actions: QuickAction[];
  title?: string;
}

// Default action configurations for different pages
const PAGE_ACTIONS: PageActionConfig[] = [
  {
    match: /^\/contracts$/,
    title: 'Contract Actions',
    actions: [
      { id: 'upload', label: 'Upload', icon: Upload, href: '/upload', variant: 'primary' },
      { id: 'search', label: 'Search', icon: Search, onClick: () => window.dispatchEvent(new CustomEvent('openSearchSpotlight')) },
      { id: 'filter', label: 'Filter', icon: Filter, onClick: () => window.dispatchEvent(new CustomEvent('toggleContractFilters')) },
      { id: 'export', label: 'Export', icon: Download, onClick: () => window.dispatchEvent(new CustomEvent('exportContracts')) },
    ],
  },
  {
    match: /^\/contracts\/[^/]+$/,
    title: 'Document Actions',
    actions: [
      { id: 'ai-chat', label: 'Ask AI', icon: Sparkles, variant: 'primary', onClick: () => window.dispatchEvent(new CustomEvent('openAIChatbot')) },
      { id: 'download', label: 'Download', icon: Download, onClick: () => window.dispatchEvent(new CustomEvent('downloadContract')) },
      { id: 'share', label: 'Share', icon: Share2, onClick: () => window.dispatchEvent(new CustomEvent('shareContract')) },
      { id: 'refresh', label: 'Reanalyze', icon: RefreshCw, onClick: () => window.dispatchEvent(new CustomEvent('reanalyzeContract')) },
    ],
  },
  {
    match: /^\/upload$/,
    title: 'Upload Actions',
    actions: [
      { id: 'templates', label: 'Templates', icon: FileText, onClick: () => window.dispatchEvent(new CustomEvent('showUploadTemplates')) },
      { id: 'bulk', label: 'Bulk Upload', icon: Plus, onClick: () => window.dispatchEvent(new CustomEvent('toggleBulkUpload')) },
      { id: 'settings', label: 'Settings', icon: Settings, href: '/settings/upload' },
    ],
  },
  {
    match: /^\/ai\/chat/,
    title: 'AI Chat Actions',
    actions: [
      { id: 'new-chat', label: 'New Chat', icon: Plus, variant: 'primary', onClick: () => window.dispatchEvent(new CustomEvent('newAIChat')) },
      { id: 'contracts', label: 'Contracts', icon: FileText, href: '/contracts' },
      { id: 'history', label: 'History', icon: RefreshCw, onClick: () => window.dispatchEvent(new CustomEvent('showChatHistory')) },
    ],
  },
  {
    match: /^\/analytics$/,
    title: 'Analytics Actions',
    actions: [
      { id: 'export', label: 'Export', icon: Download, onClick: () => window.dispatchEvent(new CustomEvent('exportAnalytics')) },
      { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => window.dispatchEvent(new CustomEvent('refreshAnalytics')) },
      { id: 'share', label: 'Share', icon: Share2, onClick: () => window.dispatchEvent(new CustomEvent('shareAnalytics')) },
    ],
  },
  {
    match: '/',
    title: 'Quick Actions',
    actions: [
      { id: 'upload', label: 'Upload', icon: Upload, href: '/upload', variant: 'primary' },
      { id: 'contracts', label: 'Contracts', icon: FileText, href: '/contracts' },
      { id: 'ai-chat', label: 'AI Chat', icon: MessageSquare, href: '/ai/chat' },
      { id: 'analytics', label: 'Analytics', icon: BarChart3, href: '/analytics' },
    ],
  },
];

interface ContextualActionBarProps {
  additionalActions?: QuickAction[];
  position?: 'top' | 'bottom';
  showOnMobile?: boolean;
}

export function ContextualActionBar({ 
  additionalActions = [],
  position = 'bottom',
  showOnMobile = false,
}: ContextualActionBarProps) {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  
  // Find matching page actions
  const pageConfig = useMemo(() => {
    for (const config of PAGE_ACTIONS) {
      if (typeof config.match === 'string') {
        if (pathname === config.match) return config;
      } else {
        if (config.match.test(pathname)) return config;
      }
    }
    return null;
  }, [pathname]);

  const actions = useMemo(() => {
    const baseActions = pageConfig?.actions || [];
    return [...baseActions, ...additionalActions];
  }, [pageConfig, additionalActions]);

  // Hide on scroll (optional)
  useEffect(() => {
    let lastScrollY = window.scrollY;
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollingDown = currentScrollY > lastScrollY;
      
      if (scrollingDown && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      
      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Don't show if no actions
  if (actions.length === 0) return null;

  const variantStyles = {
    default: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700',
    primary: 'bg-indigo-500 text-white hover:bg-indigo-600',
    success: 'bg-emerald-500 text-white hover:bg-emerald-600',
    warning: 'bg-amber-500 text-white hover:bg-amber-600',
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: position === 'bottom' ? 20 : -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: position === 'bottom' ? 20 : -20 }}
          className={cn(
            "fixed left-1/2 -translate-x-1/2 z-30",
            position === 'bottom' ? 'bottom-20 md:bottom-6' : 'top-20',
            !showOnMobile && 'hidden md:block'
          )}
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Header (collapsed view) */}
            <div 
              className={cn(
                "flex items-center justify-between px-4 py-2 cursor-pointer",
                isExpanded && "border-b border-slate-100 dark:border-slate-800"
              )}
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {pageConfig?.title || 'Quick Actions'}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  {actions.length} actions
                </span>
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                ) : (
                  <ChevronUp className="h-3 w-3 text-slate-400" />
                )}
              </div>
            </div>

            {/* Actions */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-2 p-3">
                    {actions.map((action) => {
                      const Component = action.href ? Link : 'button';
                      const props = action.href 
                        ? { href: action.href } 
                        : { onClick: action.onClick };

                      return (
                        <Component
                          key={action.id}
                          {...props as any}
                          disabled={action.disabled}
                          title={action.tooltip}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                            variantStyles[action.variant || 'default'],
                            action.disabled && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <action.icon className="h-4 w-4" />
                          <span className="hidden sm:inline">{action.label}</span>
                        </Component>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook for adding page-specific actions
export function useContextualActions(actions: QuickAction[]) {
  const [registeredActions, setRegisteredActions] = useState<QuickAction[]>(actions);

  const addAction = useCallback((action: QuickAction) => {
    setRegisteredActions(prev => [...prev, action]);
  }, []);

  const removeAction = useCallback((actionId: string) => {
    setRegisteredActions(prev => prev.filter(a => a.id !== actionId));
  }, []);

  return {
    actions: registeredActions,
    addAction,
    removeAction,
  };
}

export default ContextualActionBar;
