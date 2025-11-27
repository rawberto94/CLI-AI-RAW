/**
 * Enhanced Navigation Component
 * Features: Global search bar, notification badges, user menu, command palette trigger
 */

'use client';

import React, { useState, useCallback, useEffect, memo, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { CompactConnectionStatus } from '@/components/realtime/ConnectionStatusIndicator';
import { motion, AnimatePresence } from 'framer-motion';
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
  Bell,
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
} from 'lucide-react';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  badgeVariant?: 'default' | 'success' | 'warning' | 'error';
  description?: string;
  children?: NavigationItem[];
  isNew?: boolean;
}

const navigationItems: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    description: 'Overview & insights'
  },
  {
    name: 'Contracts',
    href: '/contracts',
    icon: FileText,
    description: 'Manage contracts',
    badge: 6
  },
  {
    name: 'Upload',
    href: '/upload',
    icon: Upload,
    description: 'Upload contracts'
  },
  {
    name: 'Analytics',
    href: '/dashboard',
    icon: BarChart3,
    description: 'Analytics & reports'
  },
  {
    name: 'Rate Cards',
    href: '/rate-cards',
    icon: CreditCard,
    description: 'Rate benchmarking',
    children: [
      {
        name: 'Dashboard',
        href: '/rate-cards/dashboard',
        icon: LayoutDashboard,
        description: 'Overview'
      },
      {
        name: 'All Entries',
        href: '/rate-cards/entries',
        icon: FileText,
        description: 'Browse entries'
      },
      {
        name: 'Benchmarking',
        href: '/rate-cards/benchmarking',
        icon: Target,
        description: 'Compare rates'
      },
      {
        name: 'Opportunities',
        href: '/rate-cards/opportunities',
        icon: TrendingUp,
        description: 'Savings potential',
        isNew: true
      }
    ]
  },
  {
    name: 'Generate',
    href: '/generate',
    icon: Sparkles,
    description: 'Create contracts',
    isNew: true,
    children: [
      {
        name: 'New Contract',
        href: '/generate',
        icon: FileText,
        description: 'Create new contract'
      },
      {
        name: 'Templates',
        href: '/generate/templates',
        icon: FileText,
        description: 'Template library'
      },
      {
        name: 'Workflows',
        href: '/generate/workflows',
        icon: Activity,
        description: 'Approval workflows'
      }
    ]
  },
  {
    name: 'Intelligence',
    href: '/intelligence',
    icon: Zap,
    description: 'AI-powered insights',
    isNew: true,
    children: [
      {
        name: 'Overview',
        href: '/intelligence',
        icon: LayoutDashboard,
        description: 'Intelligence hub'
      },
      {
        name: 'Knowledge Graph',
        href: '/intelligence/graph',
        icon: Activity,
        description: 'Contract relationships'
      },
      {
        name: 'Health Scores',
        href: '/intelligence/health',
        icon: Target,
        description: 'Contract health'
      },
      {
        name: 'AI Search',
        href: '/intelligence/search',
        icon: Search,
        description: 'Natural language search'
      },
      {
        name: 'Negotiation',
        href: '/intelligence/negotiate',
        icon: Briefcase,
        description: 'Negotiation co-pilot'
      }
    ]
  },
  {
    name: 'Approvals',
    href: '/approvals',
    icon: CheckCircle2,
    description: 'Pending approvals',
    badge: 4,
    badgeVariant: 'warning'
  },
  {
    name: 'Renewals',
    href: '/renewals',
    icon: Calendar,
    description: 'Renewal management',
    badge: 2,
    badgeVariant: 'error'
  },
  {
    name: 'Forecast',
    href: '/forecast',
    icon: TrendingUp,
    description: 'Predictive analytics',
    isNew: true
  },
  {
    name: 'Drafting',
    href: '/drafting',
    icon: Edit3,
    description: 'Smart drafting canvas',
    isNew: true
  },
  {
    name: 'Portal',
    href: '/portal',
    icon: Building2,
    description: 'Supplier collaboration'
  },
  {
    name: 'Integrations',
    href: '/integrations',
    icon: Link2,
    description: 'S2P integration hub'
  },
  {
    name: 'Governance',
    href: '/governance',
    icon: Shield,
    description: 'AI guardrails & policies',
    isNew: true
  },
  {
    name: 'Search',
    href: '/search',
    icon: Search,
    description: 'Find contracts'
  }
];

interface Notification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

// Sample notifications - in real app, fetch from API
const sampleNotifications: Notification[] = [
  {
    id: '1',
    type: 'success',
    title: 'Contract Processed',
    message: 'Acme Corp MSA has been analyzed',
    time: '5 min ago',
    read: false
  },
  {
    id: '2',
    type: 'warning',
    title: 'Rate Card Alert',
    message: 'New optimization opportunity found',
    time: '1 hour ago',
    read: false
  },
  {
    id: '3',
    type: 'info',
    title: 'Weekly Report Ready',
    message: 'Your analytics report is available',
    time: '2 hours ago',
    read: true
  }
];

function EnhancedNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(['Rate Cards']);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const unreadCount = sampleNotifications.filter(n => !n.read).length;

  // Keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setShowNotifications(false);
        setShowUserMenu(false);
        setSearchFocused(false);
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleExpanded = useCallback((name: string) => {
    setExpandedItems(prev =>
      prev.includes(name)
        ? prev.filter(item => item !== name)
        : [...prev, name]
    );
  }, []);

  const isActive = useCallback((href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }, [pathname]);

  const isChildActive = useCallback((children?: NavigationItem[]) => {
    return children?.some(child => isActive(child.href));
  }, [isActive]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
      setSearchFocused(false);
    }
  }, [searchQuery, router]);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Sparkles className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <TooltipProvider>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg p-1.5">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <span className="font-semibold text-gray-900">Contract AI</span>
        </div>
        <div className="flex items-center gap-2">
          <CompactConnectionStatus />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-30 h-screen transition-all duration-300 bg-white border-r border-gray-200/80 shadow-xl',
          'lg:translate-x-0 w-72',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo & Search */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl p-2.5 shadow-lg shadow-blue-500/20">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">Contract AI</h1>
              <p className="text-xs text-gray-500">Intelligence Platform</p>
            </div>
          </div>

          {/* Global Search */}
          <form onSubmit={handleSearch} className="relative">
            <div 
              className={cn(
                'relative transition-all duration-200',
                searchFocused && 'ring-2 ring-blue-500 ring-offset-1 rounded-lg'
              )}
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search contracts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="w-full h-10 pl-10 pr-12 bg-gray-50 border border-gray-200 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-blue-300 transition-colors"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-xs text-gray-400 bg-gray-100 rounded">
                <Command className="h-3 w-3" />K
              </kbd>
            </div>
          </form>
        </div>

        {/* User & Notifications Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/50">
          {/* User Menu */}
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowNotifications(false);
              }}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium text-sm">
                JD
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-gray-900">Roberto Ostojic</p>
                <p className="text-xs text-gray-500">Admin</p>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute left-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50"
                >
                  <Link
                    href="/settings/profile"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </Link>
                  <Link
                    href="/settings"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                  <Link
                    href="/help"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <HelpCircle className="h-4 w-4" />
                    Help & Support
                  </Link>
                  <hr className="my-1" />
                  <button 
                    onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Notifications */}
          <div ref={notificationRef} className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    setShowUserMenu(false);
                  }}
                  className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Bell className="h-5 w-5 text-gray-600" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 rounded-full text-[10px] font-medium text-white flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Notifications</TooltipContent>
            </Tooltip>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50"
                >
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Notifications</h3>
                    <button className="text-xs text-blue-600 hover:text-blue-700">
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {sampleNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={cn(
                          'px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer',
                          !notification.read && 'bg-blue-50/50'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          {getNotificationIcon(notification.type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{notification.message}</p>
                            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {notification.time}
                            </p>
                          </div>
                          {!notification.read && (
                            <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                    <Link
                      href="/notifications"
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View all notifications →
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navigationItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedItems.includes(item.name);
            const isItemActive = isActive(item.href);
            const hasActiveChild = isChildActive(item.children);

            return (
              <div key={item.name}>
                {hasChildren ? (
                  <>
                    <button
                      data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}-button`}
                      onClick={() => toggleExpanded(item.name)}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                        (isItemActive || hasActiveChild)
                          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-100'
                          : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'p-1.5 rounded-lg',
                          (isItemActive || hasActiveChild)
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-gray-100 text-gray-500'
                        )}>
                          <item.icon className="h-4 w-4" />
                        </div>
                        <span>{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.badge && (
                          <Badge 
                            variant="secondary" 
                            className="text-[10px] px-1.5 py-0 h-5 bg-blue-100 text-blue-700"
                          >
                            {item.badge}
                          </Badge>
                        )}
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        </motion.div>
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="ml-5 mt-1 space-y-0.5 border-l-2 border-gray-200 pl-3">
                            {item.children?.map((child, childIndex) => (
                              <Link
                                key={`${child.name}-${childIndex}`}
                                href={child.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={cn(
                                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200',
                                  isActive(child.href)
                                    ? 'bg-blue-50 text-blue-700 font-medium'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                )}
                              >
                                <child.icon className="h-4 w-4 flex-shrink-0" />
                                <span>{child.name}</span>
                                {child.isNew && (
                                  <Badge className="ml-auto text-[10px] px-1.5 py-0 h-4 bg-green-100 text-green-700 border-0">
                                    NEW
                                  </Badge>
                                )}
                              </Link>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                ) : (
                  <Link
                    data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}-link`}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                      isItemActive
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-100'
                        : 'text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    <div className={cn(
                      'p-1.5 rounded-lg',
                      isItemActive
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-500'
                    )}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    <span>{item.name}</span>
                    {item.badge && (
                      <Badge 
                        variant="secondary" 
                        className="ml-auto text-[10px] px-1.5 py-0 h-5 bg-blue-100 text-blue-700"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 p-3">
          {/* Keyboard Shortcuts Hint */}
          <button
            onClick={() => {
              // Trigger the ? shortcut programmatically
              const event = new KeyboardEvent('keydown', {
                key: '?',
                shiftKey: true,
                bubbles: true
              });
              document.dispatchEvent(event);
            }}
            className="w-full mb-3 p-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Command className="h-4 w-4 text-gray-500 group-hover:text-gray-700" />
                <span className="text-xs font-medium text-gray-600 group-hover:text-gray-800">Keyboard Shortcuts</span>
              </div>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-gray-300 rounded text-gray-500">?</kbd>
            </div>
          </button>

          {/* AI Status */}
          <div className="mb-3 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-100">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">AI Ready</span>
            </div>
            <p className="text-xs text-purple-700/70">All analysis features active</p>
          </div>

          {/* Version & Status */}
          <div className="text-xs text-gray-500 space-y-2">
            <div className="flex items-center justify-between">
              <span>Version</span>
              <span className="font-medium text-gray-700">2.0.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Real-time</span>
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>
    </TooltipProvider>
  );
}

export default memo(EnhancedNavigation);
