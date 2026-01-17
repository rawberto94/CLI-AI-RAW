/**
 * Global Header Bar
 * Top navigation bar with system status, search, and user actions
 * Enhanced with glassmorphism, gradient accents, and micro-animations
 */

'use client';

import { memo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Bell, 
  User, 
  Settings,
  HelpCircle,
  LogOut,
  Moon,
  Sun,
  Sparkles,
  Command,
  Clock,
  FileText,
  AlertCircle,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SystemStatusBadge } from '@/components/system/SystemStatusBadge';
import { ProcessingQueueIndicator } from '@/components/system/ProcessingQueueIndicator';
import { Badge } from '@/components/ui/badge';

interface GlobalHeaderProps {
  className?: string;
  showSearch?: boolean;
  showStatus?: boolean;
}

export const GlobalHeader = memo(function GlobalHeader({
  className,
  showSearch = true,
  showStatus = true,
}: GlobalHeaderProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  return (
    <motion.header
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={cn(
        'sticky top-0 z-50 w-full border-b border-slate-200/60 dark:border-slate-700/60',
        'bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70 dark:bg-slate-900/80 dark:supports-[backdrop-filter]:bg-slate-900/70',
        'shadow-sm shadow-slate-200/50 dark:shadow-slate-900/50',
        'motion-reduce:transition-none',
        className
      )}
      role="banner"
    >
      {/* Decorative gradient line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-80 dark:opacity-90" />
      
      <div className="flex h-14 items-center gap-4 px-4 md:px-6">
        {/* Search */}
        {showSearch && (
          <motion.div 
            className="relative flex-1 max-w-md"
            animate={{ scale: isSearchFocused ? 1.02 : 1 }}
            transition={{ duration: 0.2 }}
          >
            <Search className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors motion-reduce:transition-none",
              isSearchFocused ? "text-blue-500 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"
            )} aria-hidden="true" />
            <Input
              type="search"
              placeholder="Search contracts, clauses, suppliers..."
              aria-label="Search contracts, clauses, suppliers"
              className={cn(
                "pl-9 h-10 rounded-xl border-slate-200/80 bg-slate-50/80 transition-all duration-200 motion-reduce:transition-none",
                "dark:border-slate-600/80 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder:text-slate-500",
                "focus:bg-white focus:border-blue-300 focus:ring-2 focus:ring-blue-100",
                "dark:focus:bg-slate-800 dark:focus:border-blue-500/50 dark:focus:ring-blue-500/20",
                "placeholder:text-slate-400"
              )}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
            />
            <div className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden md:flex items-center gap-1 transition-opacity motion-reduce:transition-none",
              isSearchFocused ? "opacity-0" : "opacity-100"
            )}>
              <kbd className="inline-flex h-5 select-none items-center gap-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-1.5 font-mono text-[10px] font-medium text-slate-500 dark:text-slate-400 shadow-sm">
                <Command className="h-2.5 w-2.5" aria-hidden="true" />K
              </kbd>
            </div>
          </motion.div>
        )}

        <div className="flex-1" />

        {/* Status Indicators */}
        {showStatus && (
          <div className="flex items-center gap-2.5">
            <ProcessingQueueIndicator />
            <SystemStatusBadge showDetails />
          </div>
        )}

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="relative h-9 w-9 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-colors motion-reduce:transition-none"
              aria-label="Notifications, 3 unread"
            >
              <Bell className="h-4 w-4 text-slate-600 dark:text-slate-400" aria-hidden="true" />
              <motion.span 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] font-bold bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-full shadow-sm motion-reduce:transform-none"
                aria-hidden="true"
              >
                3
              </motion.span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 rounded-xl shadow-xl border-slate-200/80 dark:border-slate-700/80 dark:bg-slate-800">
            <DropdownMenuLabel className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                  <Bell className="h-3 w-3 text-white" aria-hidden="true" />
                </div>
                <span className="font-semibold dark:text-slate-100">Notifications</span>
              </div>
              <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                Mark all read
              </Button>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="dark:bg-slate-700" />
            <div className="max-h-72 overflow-y-auto">
              <DropdownMenuItem className="flex items-start gap-3 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg mx-1">
                <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 mt-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-900 dark:text-slate-100">Contract Processing Complete</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                    MSA-2024-001 has finished processing with all artifacts generated.
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Clock className="h-3 w-3 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">2 minutes ago</p>
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-start gap-3 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg mx-1">
                <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/50 mt-0.5">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-900 dark:text-slate-100">Deadline Approaching</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                    Vendor Agreement expires in 7 days. Review renewal options.
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Clock className="h-3 w-3 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">1 hour ago</p>
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-start gap-3 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg mx-1">
                <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/50 mt-0.5">
                  <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-900 dark:text-slate-100">New Database Sync</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                    12 contracts imported from external database.
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Clock className="h-3 w-3 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">3 hours ago</p>
                  </div>
                </div>
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator className="dark:bg-slate-700" />
            <DropdownMenuItem asChild className="p-0">
              <Link 
                href="/notifications" 
                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 rounded-b-lg transition-colors motion-reduce:transition-none"
              >
                View all notifications
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Help */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-colors motion-reduce:transition-none"
          aria-label="Help"
        >
          <HelpCircle className="h-4 w-4 text-slate-600 dark:text-slate-400" aria-hidden="true" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full p-0 hover:ring-2 hover:ring-blue-200 dark:hover:ring-blue-500/50 transition-all motion-reduce:transition-none" aria-label="User menu">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-blue-500/25 motion-reduce:transform-none"
              >
                R
              </motion.div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 rounded-xl shadow-xl border-slate-200/80 dark:border-slate-700/80 dark:bg-slate-800">
            <DropdownMenuLabel className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md" aria-hidden="true">
                  R
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Roberto</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">roberto@company.com</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="dark:bg-slate-700" />
            <div className="p-1">
              <DropdownMenuItem className="rounded-lg px-3 py-2 cursor-pointer dark:hover:bg-slate-700/50">
                <User className="mr-2.5 h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                <span className="dark:text-slate-200">Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-lg px-3 py-2 cursor-pointer dark:hover:bg-slate-700/50">
                <Settings className="mr-2.5 h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                <span className="dark:text-slate-200">Settings</span>
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator className="dark:bg-slate-700" />
            <div className="p-1">
              <DropdownMenuItem className="rounded-lg px-3 py-2 cursor-pointer dark:hover:bg-slate-700/50">
                <Sun className="mr-2.5 h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                <span className="dark:text-slate-200">Toggle Theme</span>
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator className="dark:bg-slate-700" />
            <div className="p-1">
              <DropdownMenuItem className="rounded-lg px-3 py-2 cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/30">
                <LogOut className="mr-2.5 h-4 w-4" aria-hidden="true" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.header>
  );
});
