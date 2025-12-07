/**
 * Global Header Bar
 * Top navigation bar with system status, search, and user actions
 */

'use client';

import { memo } from 'react';
import Link from 'next/link';
import { 
  Search, 
  Bell, 
  User, 
  Settings,
  HelpCircle,
  LogOut,
  Moon,
  Sun
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
  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60',
        className
      )}
    >
      <div className="flex h-14 items-center gap-4 px-4 md:px-6">
        {/* Search */}
        {showSearch && (
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Search contracts, clauses, suppliers..."
              className="pl-9 h-9 rounded-lg border-slate-200 bg-slate-50 focus:bg-white"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-slate-100 px-1.5 font-mono text-[10px] font-medium text-slate-500">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>
        )}

        <div className="flex-1" />

        {/* Status Indicators */}
        {showStatus && (
          <div className="flex items-center gap-2">
            <ProcessingQueueIndicator />
            <SystemStatusBadge showDetails />
          </div>
        )}

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="h-4 w-4 text-slate-600" />
              <Badge 
                className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-red-500"
              >
                3
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notifications</span>
              <Button variant="ghost" size="sm" className="h-6 text-xs">
                Mark all read
              </Button>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-64 overflow-y-auto">
              <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                <p className="font-medium text-sm">Contract Processing Complete</p>
                <p className="text-xs text-muted-foreground">
                  MSA-2024-001 has finished processing with all artifacts generated.
                </p>
                <p className="text-[10px] text-muted-foreground">2 minutes ago</p>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                <p className="font-medium text-sm">Deadline Approaching</p>
                <p className="text-xs text-muted-foreground">
                  Vendor Agreement expires in 7 days. Review renewal options.
                </p>
                <p className="text-[10px] text-muted-foreground">1 hour ago</p>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                <p className="font-medium text-sm">New Database Sync</p>
                <p className="text-xs text-muted-foreground">
                  12 contracts imported from external database.
                </p>
                <p className="text-[10px] text-muted-foreground">3 hours ago</p>
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/notifications" className="w-full text-center text-sm">
                View all notifications
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Help */}
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <HelpCircle className="h-4 w-4 text-slate-600" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-medium">
                R
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div>
                <p className="font-medium">Roberto</p>
                <p className="text-xs text-muted-foreground">roberto@company.com</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Sun className="mr-2 h-4 w-4" />
              Toggle Theme
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
});
