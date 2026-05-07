'use client';

/**
 * Mobile Bottom Navigation
 * Fixed bottom navigation bar for mobile devices
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Home, 
  FolderOpen, 
  Upload, 
  Search,
  BarChart3,
  Plus,
  X,
  Sparkles,
  GitBranch,
  Lightbulb,
  PenTool,
  Truck,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { canAccessNavigationAudience, getNavigationAudiences, type NavigationAudience } from '@/lib/navigation/visibility';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  audiences?: NavigationAudience[];
  activeMatch?: (pathname: string) => boolean;
}

interface QuickAction {
  label: string;
  icon: React.ElementType;
  href?: string;
  onClick?: () => void;
  audiences?: NavigationAudience[];
  color: string;
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [showQuickActions, setShowQuickActions] = useState(false);

  const userRole = session?.user?.role || 'member';
  const activeAudiences = useMemo(() => getNavigationAudiences(userRole), [userRole]);

  const openAIAssistant = useCallback(() => {
    window.dispatchEvent(new CustomEvent('openAIChatbot', {
      detail: { autoMessage: 'Hi! How can I help you with your contracts today?' },
    }));
  }, []);

  const navItems = useMemo<NavItem[]>(() => {
    const primaryItems: NavItem[] = [
      {
        href: '/dashboard',
        label: 'Home',
        icon: Home,
        audiences: ['all'],
        activeMatch: (p) => p === '/dashboard',
      },
      {
        href: '/contracts',
        label: 'Contracts',
        icon: FolderOpen,
        audiences: ['all'],
        activeMatch: (p) => p.startsWith('/contracts'),
      },
    ];

    if (activeAudiences.has('commercial')) {
      primaryItems.push({
        href: '/suppliers',
        label: 'Suppliers',
        icon: Truck,
        audiences: ['commercial'],
        activeMatch: (p) => p.startsWith('/suppliers') || p.startsWith('/rate-cards') || p.startsWith('/spend') || p.startsWith('/forecast'),
      });
    } else if (activeAudiences.has('operator')) {
      primaryItems.push({
        href: '/workflows',
        label: 'Workflows',
        icon: GitBranch,
        audiences: ['operator'],
        activeMatch: (p) => p.startsWith('/workflows') || p.startsWith('/approvals') || p.startsWith('/requests') || p.startsWith('/self-service'),
      });
    } else {
      primaryItems.push({
        href: '/renewals',
        label: 'Renewals',
        icon: Calendar,
        audiences: ['all'],
        activeMatch: (p) => p.startsWith('/renewals') || p.startsWith('/obligations') || p.startsWith('/deadlines'),
      });
    }

    if (activeAudiences.has('oversight')) {
      primaryItems.push({
        href: '/analytics',
        label: 'Analytics',
        icon: BarChart3,
        audiences: ['oversight'],
        activeMatch: (p) => p.startsWith('/analytics') || p.startsWith('/reports'),
      });
    } else if (activeAudiences.has('legal')) {
      primaryItems.push({
        href: '/drafting',
        label: 'Drafting',
        icon: PenTool,
        audiences: ['legal'],
        activeMatch: (p) => p.startsWith('/drafting') || p.startsWith('/playbooks') || p.startsWith('/clauses') || p.startsWith('/templates'),
      });
    } else {
      primaryItems.push({
        href: '/intelligence',
        label: 'Insights',
        icon: Lightbulb,
        audiences: ['all'],
        activeMatch: (p) => p.startsWith('/intelligence') || p.startsWith('/risk') || p.startsWith('/compliance') || p.startsWith('/knowledge-graph'),
      });
    }

    return primaryItems.filter((item) => canAccessNavigationAudience(item.audiences, activeAudiences)).slice(0, 4);
  }, [activeAudiences]);

  const quickActions = useMemo<QuickAction[]>(() => {
    const actions: QuickAction[] = [
      { label: 'Upload Contract', icon: Upload, href: '/upload', audiences: ['operator'], color: 'bg-violet-500' },
      { label: 'Start Draft', icon: PenTool, href: '/drafting', audiences: ['operator'], color: 'bg-violet-500' },
      { label: 'AI Assistant', icon: Sparkles, onClick: openAIAssistant, audiences: ['all'], color: 'bg-violet-500' },
      { label: 'Smart Search', icon: Search, href: '/search', audiences: ['all'], color: 'bg-amber-500' },
      { label: 'Analytics', icon: BarChart3, href: '/analytics', audiences: ['oversight'], color: 'bg-violet-500' },
    ];
    return actions.filter((action) => canAccessNavigationAudience(action.audiences, activeAudiences));
  }, [activeAudiences, openAIAssistant]);

  const isActive = (item: NavItem) => {
    if (item.activeMatch) return item.activeMatch(pathname);
    return pathname === item.href;
  };

  const toggleQuickActions = useCallback(() => {
    setShowQuickActions(prev => !prev);
  }, []);

  return (
    <>
      {/* Quick Actions Overlay */}
      <AnimatePresence>
        {showQuickActions && (
          <div key="quick-actions" className="contents">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQuickActions(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
            />
            
            {/* Quick Actions Menu */}
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-20 left-0 right-0 z-50 p-4 md:hidden"
            >
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                  Quick Actions
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {quickActions.map((action) => (
                    action.href ? (
                      <Link
                        key={action.label}
                        href={action.href}
                        onClick={() => {
                          setShowQuickActions(false);
                          action.onClick?.();
                        }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <div className={cn("p-2 rounded-lg text-white", action.color)}>
                          <action.icon className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {action.label}
                        </span>
                      </Link>
                    ) : (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => {
                          setShowQuickActions(false);
                          action.onClick?.();
                        }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
                      >
                        <div className={cn("p-2 rounded-lg text-white", action.color)}>
                          <action.icon className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {action.label}
                        </span>
                      </button>
                    )
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 safe-area-inset-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.slice(0, 2).map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors",
                  active ? "text-violet-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400"
                )}
              >
                <item.icon className={cn("h-5 w-5", active && "fill-current")} />
                <span className="text-[10px] font-medium">{item.label}</span>
                {active && (
                  <motion.div
                    layoutId="bottomNavIndicator"
                    className="absolute bottom-1 w-1 h-1 rounded-full bg-violet-600 dark:bg-violet-400"
                  />
                )}
              </Link>
            );
          })}

          {/* Center FAB */}
          <div className="relative flex items-center justify-center px-2">
            <motion.button
              onClick={toggleQuickActions}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "relative -top-4 flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-colors",
                showQuickActions
                  ? "bg-slate-900 dark:bg-white"
                  : "bg-gradient-to-r from-violet-500 to-purple-600"
              )}
            >
              <AnimatePresence mode="wait">
                {showQuickActions ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                  >
                    <X className="h-6 w-6 text-white dark:text-slate-900" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="plus"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                  >
                    <Plus className="h-6 w-6 text-white" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>

          {navItems.slice(2).map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors",
                  active ? "text-violet-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400"
                )}
              >
                <item.icon className={cn("h-5 w-5", active && "fill-current")} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      
      {/* Spacer for content */}
      <div className="h-16 md:hidden" />
    </>
  );
}

export default MobileBottomNav;
