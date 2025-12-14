/**
 * Enhanced Navigation Component
 * Clean, professional sidebar with grouped navigation
 */

'use client';

import React, { useState, useCallback, useEffect, memo, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { CompactConnectionStatus } from '@/components/realtime/ConnectionStatusIndicator';
import { NotificationBell } from '@/components/collaboration/NotificationCenter';
import { ConTigoLogoSVG } from '@/components/ui/ConTigoLogo';
import { ThemeToggle } from '@/components/theme/ThemeProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnClickOutside } from '@/hooks/useEventListener';
import {
  LayoutDashboard,
  FileText,
  Search,
  BarChart3,
  Settings,
  Upload,
  Activity,
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  Briefcase,
  FileBarChart,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Target,
  Command,
  User,
  LogOut,
  HelpCircle,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  Edit3,
  Link2,
  Building2,
  Shield,
  FolderKanban,
  Brain,
  Database,
  Keyboard,
} from 'lucide-react';

interface NavigationItem {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  badgeVariant?: 'default' | 'success' | 'warning' | 'error';
  description?: string;
  children?: NavigationItem[];
  isNew?: boolean;
  action?: 'openAIChatbot'; // Special actions handled in component
  requiresAdmin?: boolean; // Only show for admin/owner users
}

interface NavigationGroup {
  id: string;
  label: string;
  items: NavigationItem[];
  requiresAdmin?: boolean; // Only show entire group for admin/owner users
}

// Streamlined navigation - Core features only
const navigationGroups: NavigationGroup[] = [
  {
    id: 'main',
    label: 'Main',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard, description: 'Overview & insights' },
      { name: 'Contracts', href: '/contracts', icon: FileText, description: 'Manage your contracts' },
      { name: 'Compare', href: '/compare', icon: Target, description: 'Side-by-side contract comparison', isNew: true },
    ]
  },
  {
    id: 'intelligence',
    label: 'AI Intelligence',
    items: [
      { 
        name: 'AI Chatbot', 
        icon: Brain, 
        description: 'Ask questions about your contracts',
        action: 'openAIChatbot'
      },
    ]
  },
  {
    id: 'self-service',
    label: 'Self-Service',
    items: [
      { 
        name: 'AI Report Builder', 
        href: '/reports/ai-builder', 
        icon: FileBarChart, 
        description: 'Generate AI-powered contract summaries',
        isNew: true
      },
    ]
  },
  {
    id: 'analytics',
    label: 'Analytics',
    items: [
      { name: 'Reports', href: '/analytics', icon: BarChart3, description: 'Analytics & reports' },
    ]
  },
  {
    id: 'admin',
    label: 'Administration',
    requiresAdmin: true,
    items: [
      { name: 'Clients', href: '/platform', icon: Users, description: 'Manage all client organizations', requiresAdmin: true, isNew: true },
      { name: 'My Organization', href: '/admin', icon: Building2, description: 'Manage team & settings', requiresAdmin: true },
      { name: 'Data Connections', href: '/admin/integrations', icon: Database, description: 'Connect external databases', requiresAdmin: true, isNew: true },
      { name: 'Queue Dashboard', href: '/admin/queue', icon: Activity, description: 'Monitor processing queues', requiresAdmin: true, isNew: true },
      { name: 'Settings', href: '/settings', icon: Settings, description: 'System settings', requiresAdmin: true },
    ]
  },
];

// Render a single navigation item
function NavItem({ 
  item, 
  isActive, 
  isChildActive, 
  isExpanded, 
  onToggle, 
  onMobileClose,
  onAction
}: { 
  item: NavigationItem;
  isActive: (href?: string) => boolean;
  isChildActive: (children?: NavigationItem[]) => boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onMobileClose: () => void;
  onAction: (action: string) => void;
}) {
  const hasChildren = item.children && item.children.length > 0;
  const itemActive = item.href ? isActive(item.href) : false;
  const hasActiveChild = isChildActive(item.children);
  
  const getBadgeStyles = (variant?: string) => {
    switch (variant) {
      case 'error':
        return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
      case 'warning':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'success':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      default:
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    }
  };

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-controls={`nav-children-${item.name.replace(/\s+/g, '-').toLowerCase()}`}
          className={cn(
            'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50',
            (itemActive || hasActiveChild)
              ? 'bg-blue-50/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              : 'text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100'
          )}
        >
          <div className="flex items-center gap-2.5">
            <item.icon className={cn(
              'h-4 w-4',
              (itemActive || hasActiveChild) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'
            )} />
            <span className="font-medium">{item.name}</span>
            {item.isNew && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 rounded-full">
                NEW
              </span>
            )}
          </div>
          <ChevronDown className={cn(
            'h-4 w-4 text-gray-400 dark:text-slate-500 transition-transform duration-200',
            isExpanded && 'rotate-180'
          )} aria-hidden="true" />
        </button>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
              id={`nav-children-${item.name.replace(/\s+/g, '-').toLowerCase()}`}
              role="group"
              aria-label={`${item.name} submenu`}
            >
              <div className="ml-6 mt-1 space-y-0.5 border-l border-gray-200 dark:border-slate-700 pl-3">
                {item.children?.map((child) => (
                  <Link
                    key={child.href || child.name}
                    href={child.href || '#'}
                    onClick={onMobileClose}
                    className={cn(
                      'flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50',
                      isActive(child.href)
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium'
                        : 'text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-200'
                    )}
                  >
                    <child.icon className="h-3.5 w-3.5" />
                    <span>{child.name}</span>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // If item has action but no href, render as button
  if (item.action && !item.href) {
    return (
      <button
        onClick={() => {
          onAction(item.action!);
          onMobileClose();
        }}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50',
          'text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100'
        )}
      >
        <item.icon className="h-4 w-4 text-gray-400 dark:text-slate-500" />
        <span className="font-medium">{item.name}</span>
        {item.isNew && (
          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 rounded-full">
            NEW
          </span>
        )}
      </button>
    );
  }

  return (
    <Link
      href={item.href || '/'}
      onClick={onMobileClose}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50',
        itemActive
          ? 'bg-blue-50/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
          : 'text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100'
      )}
    >
      <item.icon className={cn(
        'h-4 w-4',
        itemActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'
      )} />
      <span className="font-medium">{item.name}</span>
      {item.isNew && (
        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 rounded-full">
          NEW
        </span>
      )}
      {item.badge && (
        <Badge className={cn(
          'ml-auto text-[10px] px-1.5 h-5 border-0',
          getBadgeStyles(item.badgeVariant)
        )}>
          {item.badge}
        </Badge>
      )}
    </Link>
  );
}

function EnhancedNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(['AI Hub']);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [isViewingAsClient, setIsViewingAsClient] = useState(false);

  // Check if admin is viewing as a client (hide admin tabs in this mode)
  useEffect(() => {
    const viewAsTenantId = sessionStorage.getItem("viewAsTenantId");
    setIsViewingAsClient(!!viewAsTenantId);
  }, [pathname]); // Re-check on route changes

  // Check if user is admin/owner (power user)
  const userRole = session?.user?.role || 'member';
  const isAdmin = (userRole === 'admin' || userRole === 'owner') && !isViewingAsClient;

  // Filter navigation groups based on user role (hide admin when viewing as client)
  const filteredNavigationGroups = navigationGroups
    .filter(group => !group.requiresAdmin || isAdmin)
    .map(group => ({
      ...group,
      items: group.items.filter(item => !item.requiresAdmin || isAdmin)
    }))
    .filter(group => group.items.length > 0);

  // Keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setShowUserMenu(false);
        setSearchFocused(false);
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdowns on outside click
  const closeUserMenu = useCallback(() => {
    setShowUserMenu(false);
  }, []);
  
  useOnClickOutside(userMenuRef, closeUserMenu);

  const toggleExpanded = useCallback((name: string) => {
    setExpandedItems(prev =>
      prev.includes(name)
        ? prev.filter(item => item !== name)
        : [...prev, name]
    );
  }, []);

  const isActive = useCallback((href?: string) => {
    if (!href) return false;
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }, [pathname]);

  const isChildActive = useCallback((children?: NavigationItem[]): boolean => {
    return children?.some(child => child.href && isActive(child.href)) ?? false;
  }, [isActive]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
      setSearchFocused(false);
    }
  }, [searchQuery, router]);

  // Handle special navigation actions (like opening AI chatbot)
  const handleNavAction = useCallback((action: string) => {
    if (action === 'openAIChatbot') {
      window.dispatchEvent(new CustomEvent('openAIChatbot'));
    }
  }, []);

  // Open keyboard shortcuts modal
  const openKeyboardShortcuts = useCallback(() => {
    window.dispatchEvent(new CustomEvent('openKeyboardShortcuts'));
  }, []);

  return (
    <TooltipProvider>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-200/60 dark:border-slate-700/60 px-4 py-3 flex items-center justify-between">
        <ConTigoLogoSVG size="md" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <NotificationBell />
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-30 h-screen transition-transform duration-300 ease-out',
          'bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-r border-gray-200/60 dark:border-slate-700/60',
          'lg:translate-x-0 w-64',
          isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100 dark:border-slate-700">
            <ConTigoLogoSVG size="lg" />
          </div>

          {/* Search */}
          <div className="px-3 py-3">
            <form onSubmit={handleSearch}>
              <div className={cn(
                'relative transition-all duration-200 rounded-lg',
                searchFocused && 'ring-2 ring-blue-500/30'
              )}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  className="w-full h-9 pl-9 pr-10 bg-gray-50/80 dark:bg-slate-800/80 border border-gray-200/60 dark:border-slate-600/60 rounded-lg text-sm placeholder:text-gray-400 dark:placeholder:text-slate-500 text-gray-900 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:flex items-center px-1.5 py-0.5 text-[10px] text-gray-400 dark:text-slate-500 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded font-mono">
                  ⌘K
                </kbd>
              </div>
            </form>
          </div>

          {/* Navigation Groups */}
          <nav className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-slate-600">
            {filteredNavigationGroups.map((group, groupIndex) => (
              <div key={group.id} className={cn(groupIndex > 0 && 'mt-5')}>
                <h3 className="px-3 mb-1.5 text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                  {group.label}
                </h3>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavItem
                      key={item.name}
                      item={item}
                      isActive={isActive}
                      isChildActive={isChildActive}
                      isExpanded={expandedItems.includes(item.name)}
                      onToggle={() => toggleExpanded(item.name)}
                      onMobileClose={() => setIsMobileMenuOpen(false)}
                      onAction={handleNavAction}
                    />
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="border-t border-gray-100 dark:border-slate-700 p-3 space-y-3">
            {/* Quick Actions */}
            <div className="flex items-center justify-between px-2">
              <ThemeToggle />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={openKeyboardShortcuts}
                  >
                    <Keyboard className="h-4 w-4 text-gray-500" />
                    <span className="sr-only">Keyboard shortcuts</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Keyboard shortcuts (⌘K)</p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            {/* User */}
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-medium text-xs shadow-sm overflow-hidden">
                  {session?.user?.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={session.user.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{session?.user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}</span>
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{session?.user?.name || 'User'}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 capitalize">{userRole}</p>
                </div>
                <Settings className="h-4 w-4 text-gray-400" />
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 py-1 z-50"
                  >
                    <Link href="/settings/profile" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700">
                      <User className="h-4 w-4" /> Profile
                    </Link>
                    <Link href="/settings" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700">
                      <Settings className="h-4 w-4" /> Settings
                    </Link>
                    <hr className="my-1 dark:border-slate-700" />
                    <button onClick={() => signOut({ callbackUrl: '/auth/signin' })} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20">
                      <LogOut className="h-4 w-4" /> Sign Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between px-2 text-[10px] text-gray-400 dark:text-gray-500">
              <span>v2.0.0</span>
              <CompactConnectionStatus />
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-20 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>
    </TooltipProvider>
  );
}

export default memo(EnhancedNavigation);
