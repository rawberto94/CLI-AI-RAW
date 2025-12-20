'use client';

/**
 * Mobile Bottom Navigation
 * Fixed bottom navigation bar for mobile devices
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Home, 
  FolderOpen, 
  Upload, 
  MessageSquare, 
  Menu,
  Search,
  BarChart3,
  Plus,
  X,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  activeMatch?: (pathname: string) => boolean;
}

const navItems: NavItem[] = [
  { 
    href: '/', 
    label: 'Home', 
    icon: Home,
    activeMatch: (p) => p === '/'
  },
  { 
    href: '/contracts', 
    label: 'Contracts', 
    icon: FolderOpen,
    activeMatch: (p) => p.startsWith('/contracts')
  },
  { 
    href: '/upload', 
    label: 'Upload', 
    icon: Upload,
    activeMatch: (p) => p.startsWith('/upload')
  },
  { 
    href: '/ai/chat', 
    label: 'AI Chat', 
    icon: MessageSquare,
    activeMatch: (p) => p.startsWith('/ai')
  },
];

interface QuickAction {
  label: string;
  icon: React.ElementType;
  href?: string;
  onClick?: () => void;
  color: string;
}

const quickActions: QuickAction[] = [
  { label: 'Upload Contract', icon: Upload, href: '/upload', color: 'bg-blue-500' },
  { label: 'AI Assistant', icon: Sparkles, href: '/ai/chat', color: 'bg-purple-500' },
  { label: 'Smart Search', icon: Search, href: '/search', color: 'bg-amber-500' },
  { label: 'Analytics', icon: BarChart3, href: '/analytics', color: 'bg-emerald-500' },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const [showQuickActions, setShowQuickActions] = useState(false);

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
          <>
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
                    <Link
                      key={action.label}
                      href={action.href || '#'}
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
                  ))}
                </div>
              </div>
            </motion.div>
          </>
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
                  active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400"
                )}
              >
                <item.icon className={cn("h-5 w-5", active && "fill-current")} />
                <span className="text-[10px] font-medium">{item.label}</span>
                {active && (
                  <motion.div
                    layoutId="bottomNavIndicator"
                    className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400"
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
                  : "bg-gradient-to-r from-indigo-500 to-purple-600"
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
                  active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400"
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
