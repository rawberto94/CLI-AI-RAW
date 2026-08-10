/**
 * Enhanced Navigation Component
 * Clean, professional sidebar with grouped navigation
 */

'use client';

import React, { useState, useCallback, useEffect, useMemo, memo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { CompactConnectionStatus } from '@/components/realtime/ConnectionStatusIndicator';
import { AgentNotificationBell as NotificationBell } from '@/components/ai/AgentNotificationBell';
import { ConTigoLogoSVG } from '@/components/ui/ConTigoLogo';
import { ThemeToggle } from '@/components/theme/ThemeProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnClickOutside } from '@/hooks/useEventListener';
import { useConfirm, confirmPresets } from '@/components/dialogs/ConfirmDialog';
import {
  canAccessNavigationAudience,
  getNavigationAudiences,
  isAdminNavigationRole,
  type NavigationAudience,
} from '@/lib/navigation/visibility';
import { useDemoMode } from '@/hooks/useDemoMode';
import { Target } from 'lucide-react';
import {
  LayoutDashboard,
  FileText,
  Search,
  BarChart3,
  Settings,
  Upload,
  Calendar,
  Menu,
  X,
  ChevronDown,
  User,
  LogOut,
  Sparkles,
  CheckCircle2,
  Clock,
  Zap,
  Building2,
  Shield,
  FolderKanban,
  Keyboard,
  RefreshCcw,
  GitBranch,
  BookOpen,
  Lightbulb,
  Truck,
  Receipt,
  Monitor,  Wallet,
  ShieldCheck,
  ClipboardCheck,
  AlertTriangle,
  CheckSquare,
  PenTool,
  ScrollText,
  Gavel,
  ArrowLeftRight,
  Gauge,
  Rocket,
  Bot,
  ListChecks,
} from 'lucide-react';

interface NavigationItem {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  audiences?: NavigationAudience[];
  badge?: string | number;
  badgeVariant?: 'default' | 'success' | 'warning' | 'error';
  description?: string;
  children?: NavigationItem[];
  isNew?: boolean;
  action?: 'openAIChatbot';
  requiresAdmin?: boolean;
  /** 'hide' = excluded when NEXT_PUBLIC_DEMO_MODE=true */
  demo?: 'hide';
}

interface NavigationGroup {
  id: string;
  label: string;
  audiences?: NavigationAudience[];
  items: NavigationItem[];
  requiresAdmin?: boolean;
}

// Static config: `key`/`groupKey` resolve to messages/{locale}.json under
// `navigation.nav.<key>.{name,desc}` and `navigation.groups.<groupKey>`.
// The translated NavigationItem/NavigationGroup shapes above are built from
// this at render time via resolveNavigationConfig().
interface NavigationItemConfig {
  key: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  audiences?: NavigationAudience[];
  badge?: string | number;
  badgeVariant?: 'default' | 'success' | 'warning' | 'error';
  children?: NavigationItemConfig[];
  isNew?: boolean;
  action?: 'openAIChatbot';
  requiresAdmin?: boolean;
  demo?: 'hide';
}

interface NavigationGroupConfig {
  id: string;
  groupKey: string;
  audiences?: NavigationAudience[];
  items: NavigationItemConfig[];
  requiresAdmin?: boolean;
}

// Enterprise navigation: keep the primary rail job-based, not page-based.
// Deep or specialized destinations stay one level down or inside their local pages.
const navigationConfig: NavigationGroupConfig[] = [
  {
    id: 'workspace',
    groupKey: 'workspace',
    items: [
      { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard, audiences: ['all'] },
      {
        key: 'contracts',
        href: '/contracts',
        icon: FileText,
        audiences: ['all'],
        children: [
          { key: 'upload', href: '/upload', icon: Upload, audiences: ['operator'] },
          { key: 'clauses', href: '/clauses', icon: BookOpen, audiences: ['legal'], demo: 'hide' },
        ],
      },
      {
        key: 'draftingStudio',
        href: '/drafting',
        icon: PenTool,
        audiences: ['operator'],
        demo: 'hide',
        children: [
          { key: 'templates', href: '/templates', icon: FolderKanban, audiences: ['legal'], demo: 'hide' },
          { key: 'playbooks', href: '/playbooks', icon: Gavel, audiences: ['legal'], demo: 'hide' },
          { key: 'policy-packs', href: '/policy-packs', icon: Shield, audiences: ['legal'], demo: 'hide' },
        ],
      }
    ],
  },
  {
    id: 'execution',
    groupKey: 'execution',
    items: [
      {
        key: 'workflows',
        href: '/workflows',
        icon: GitBranch,
        audiences: ['operator'],
        demo: 'hide',
        children: [
          { key: 'approvals', href: '/inbox', icon: CheckCircle2, audiences: ['oversight'], demo: 'hide' },
          { key: 'requests', href: '/requests', icon: Zap, audiences: ['operator'], demo: 'hide' },
          { key: 'myTasks', href: '/self-service/my-requests', icon: CheckSquare, audiences: ['operator'], demo: 'hide' },
        ],
      },
      {
        key: 'obligationsRenewals',
        href: '/renewals-obligations',
        icon: Calendar,
        audiences: ['all'],
        children: [
          { key: 'obligations', href: '/obligations', icon: Target, audiences: ['all'] },
          { key: 'renewals', href: '/renewals', icon: RefreshCcw, audiences: ['all'] },
          { key: 'deadlines', href: '/deadlines', icon: Clock, audiences: ['all'] },
        ],
      },
      {
        key: 'suppliersSpend',
        href: '/suppliers',
        icon: Truck,
        audiences: ['commercial'],
        demo: 'hide',
        children: [
          { key: 'rateCards', href: '/rate-cards/dashboard', icon: Receipt, audiences: ['commercial'], demo: 'hide' },
          { key: 'spendAnalysis', href: '/spend', icon: Wallet, audiences: ['commercial'], demo: 'hide' },
        ],
      }
    ],
  },
  {
    id: 'insights',
    groupKey: 'insights',
    items: [
      {
        key: 'intelligence',
        href: '/intelligence',
        icon: Lightbulb,
        audiences: ['all'],
        demo: 'hide',
        children: [
          { key: 'contractHealth', href: '/intelligence/health', icon: ShieldCheck, audiences: ['all'], demo: 'hide' },
          { key: 'risk', href: '/risk', icon: AlertTriangle, audiences: ['all'], demo: 'hide' },
          { key: 'compliance', href: '/compliance', icon: ClipboardCheck, audiences: ['legal'], demo: 'hide' },
        ],
      },
      {
        key: 'analytics',
        href: '/analytics',
        icon: BarChart3,
        audiences: ['oversight'],
        demo: 'hide',
      }
    ],
  },
  {
    id: 'platform',
    groupKey: 'platform',
    items: [
      {
        key: 'governance',
        href: '/governance',
        icon: Shield,
        audiences: ['legal'],
        demo: 'hide',
        children: [
          { key: 'aiDecisions', href: '/governance/ai-decisions', icon: ScrollText, audiences: ['legal'], demo: 'hide' },
        ],
      },
      { key: 'contractMigration', href: '/migration', icon: Upload, audiences: ['all'], isNew: true },
      {
        key: 'contigoLabs',
        href: '/contigo-labs',
        icon: Rocket,
        audiences: ['all'],
        demo: 'hide',
        children: [
          { key: 'labsAgents', href: '/contigo-labs?tab=agents', icon: Bot, audiences: ['all'], demo: 'hide' },
          { key: 'labsApprovals', href: '/contigo-labs?tab=approvals', icon: ListChecks, audiences: ['all'], demo: 'hide' },
          { key: 'labsRfx', href: '/contigo-labs?tab=rfx-studio', icon: Gavel, audiences: ['all'], demo: 'hide' },
          { key: 'observability', href: '/contigo-labs?tab=observability', icon: Gauge, audiences: ['all'], demo: 'hide' },
        ],
      },
      { key: 'settings', href: '/settings', icon: Settings, audiences: ['all'] },
    ],
  },
  {
    id: 'admin',
    groupKey: 'admin',
    audiences: ['admin'],
    requiresAdmin: true,
    // Single entry point: /admin owns its own sidebar (app/admin/layout.tsx), so
    // mirroring its sections here just gave admins two competing menus.
    items: [
      { key: 'organization', href: '/admin', icon: Building2, audiences: ['admin'], requiresAdmin: true },
    ],
  },
];

// Resolves the static key-based config above into the translated NavigationGroup[]
// shape the rest of this file renders, using the given next-intl translator.
function resolveNavigationConfig(t: (key: string) => string): NavigationGroup[] {
  const resolveItem = (item: NavigationItemConfig): NavigationItem => {
    const { key, children, ...rest } = item;
    return {
      ...rest,
      name: t(`nav.${key}.name`),
      description: t(`nav.${key}.desc`),
      children: children?.map(resolveItem),
    };
  };

  return navigationConfig.map(({ groupKey, items, ...rest }) => ({
    ...rest,
    label: t(`groups.${groupKey}`),
    items: items.map(resolveItem),
  }));
}

// Demo mode toggle button — reads localStorage directly, no hooks needed
function DemoModeToggle() {
  // When NEXT_PUBLIC_DEMO_MODE=true is baked into the build, demo mode is locked
  // by the operator (e.g. Stadler demo). Hide the toggle so users can't disable it.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return null;

  const isDemo =
    (typeof window !== 'undefined' &&
      (window.localStorage.getItem('contigo_demo_mode') === 'true' ||
        new URLSearchParams(window.location.search).get('demo') === '1' ||
        new URLSearchParams(window.location.search).get('demo') === 'true')) ||
    false;

  return (
    <button
      onClick={() => {
        if (isDemo) {
          window.localStorage.removeItem('contigo_demo_mode');
        } else {
          window.localStorage.setItem('contigo_demo_mode', 'true');
        }
        window.location.reload();
      }}
      className={cn(
        'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border',
        isDemo
          ? 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800'
          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
      )}
      title={isDemo ? 'Demo mode is ON — click to restore full navigation' : 'Demo mode is OFF — click to show demo view'}
    >
      <span className="flex items-center gap-2">
        <Monitor className="h-4 w-4" />
        {isDemo ? 'Demo Mode: ON' : 'Demo Mode: OFF'}
      </span>
      <span
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
          isDemo ? 'bg-violet-500' : 'bg-gray-300 dark:bg-slate-600'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
            isDemo ? 'translate-x-[18px]' : 'translate-x-0.5'
          )}
        />
      </span>
    </button>
  );
}

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
        return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
      default:
        return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
    }
  };

  if (hasChildren) {
    return (
      <div>
        <div
          className={cn(
            'flex items-center gap-1',
          )}
        >
          <Link
            href={item.href || '#'}
            onClick={onMobileClose}
            aria-current={itemActive ? 'page' : undefined}
            className={cn(
              'flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-left',
              (itemActive || hasActiveChild)
                ? 'bg-violet-50/80 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400'
                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100'
            )}
          >
            <item.icon className={cn(
              'h-4 w-4',
              (itemActive || hasActiveChild) ? 'text-violet-600 dark:text-violet-400' : 'text-gray-400 dark:text-slate-500'
            )} />
            <span className="font-medium">{item.name}</span>
            {item.isNew && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-400 rounded-full">
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
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-controls={`nav-children-${item.name.replace(/\s+/g, '-').toLowerCase()}`}
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${item.name}`}
            className={cn(
              'shrink-0 flex h-9 w-9 items-center justify-center rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/50',
              (itemActive || hasActiveChild)
                ? 'text-violet-700 dark:text-violet-400 hover:bg-violet-100/80 dark:hover:bg-violet-900/40'
                : 'text-gray-400 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800'
            )}
          >
            <ChevronDown className={cn(
              'h-4 w-4 transition-transform duration-200',
              isExpanded && 'rotate-180'
            )} aria-hidden="true" />
          </button>
        </div>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div key="expanded"
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
                    aria-current={isActive(child.href) ? 'page' : undefined}
                    className={cn(
                      'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-left',
                      isActive(child.href)
                        ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 font-medium'
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
          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/50',
          'text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100'
        )}
      >
        <item.icon className="h-4 w-4 text-gray-400 dark:text-slate-500" />
        <span className="font-medium">{item.name}</span>
        {item.isNew && (
          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-400 rounded-full">
            NEW
          </span>
        )}
      </button>
    );
  }

  return (
    <Link
      href={item.href || '#'}
      onClick={onMobileClose}
      aria-current={itemActive ? 'page' : undefined}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-left',
        itemActive
          ? 'bg-violet-50/80 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400'
          : 'text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100'
      )}
    >
      <item.icon className={cn(
        'h-4 w-4',
        itemActive ? 'text-violet-600 dark:text-violet-400' : 'text-gray-400 dark:text-slate-500'
      )} />
      <span className="font-medium">{item.name}</span>
      {item.isNew && (
        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-400 rounded-full">
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
  const confirm = useConfirm();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
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
  const isAdmin = useMemo(
    () => isAdminNavigationRole(userRole, { viewingAsClient: isViewingAsClient }),
    [userRole, isViewingAsClient]
  );
  const activeAudiences = useMemo(
    () => getNavigationAudiences(userRole, { viewingAsClient: isViewingAsClient }),
    [userRole, isViewingAsClient]
  );

  const isDemo = useDemoMode();

  const tNav = useTranslations('navigation');
  const navigationGroups = useMemo(() => resolveNavigationConfig(tNav), [tNav]);

  // Unified "Needs you" badge count (Phase 1.4) — source of truth is /api/inbox
  const [inboxCount, setInboxCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/inbox?limit=1');
        if (!res.ok) return;
        const json = await res.json();
        const total = json.data?.stats?.total ?? json.stats?.total ?? 0;
        if (!cancelled) setInboxCount(typeof total === 'number' ? total : 0);
      } catch {
        // best-effort badge
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pathname]);

  const filteredNavigationGroups = useMemo(() => {
    const injectInboxBadge = (item: NavigationItem): NavigationItem => {
      if (item.href === '/inbox' || item.href === '/approvals') {
        return {
          ...item,
          badge: inboxCount > 0 ? inboxCount : undefined,
          badgeVariant: inboxCount > 0 ? 'warning' : undefined,
          children: item.children?.map(injectInboxBadge),
        };
      }
      return {
        ...item,
        children: item.children?.map(injectInboxBadge),
      };
    };

    const filterItem = (item: NavigationItem): NavigationItem | null => {
      const visibleChildren = item.children
        ?.map(filterItem)
        .filter((child): child is NavigationItem => child !== null);

      if (isDemo && item.demo === 'hide') {
        return visibleChildren && visibleChildren.length > 0
          ? { ...item, children: visibleChildren }
          : null;
      }

      const canShowItem =
        canAccessNavigationAudience(item.audiences, activeAudiences) &&
        (!item.requiresAdmin || isAdmin);

      if (!canShowItem && (!visibleChildren || visibleChildren.length === 0)) {
        return null;
      }

      return injectInboxBadge({
        ...item,
        children: visibleChildren,
      });
    };

    return navigationGroups
      .filter((group) => canAccessNavigationAudience(group.audiences, activeAudiences))
      .filter((group) => !group.requiresAdmin || isAdmin)
      .map((group) => ({
        ...group,
        items: group.items
          .map(filterItem)
          .filter((item): item is NavigationItem => item !== null),
      }))
      .filter((group) => group.items.length > 0);
  }, [navigationGroups, activeAudiences, isAdmin, isDemo, inboxCount]);

  // Keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  const searchParams = useSearchParams();

  // All registered nav pathnames (no query). Used so `/admin` does not steal
  // active state from more specific siblings like `/admin/ux-metrics`.
  const navPathnames = useMemo(() => {
    const paths = new Set<string>();
    const walk = (items: NavigationItem[]) => {
      for (const item of items) {
        if (item.href) {
          paths.add(item.href.split('?')[0]);
        }
        if (item.children?.length) walk(item.children);
      }
    };
    for (const group of filteredNavigationGroups) {
      walk(group.items);
    }
    return paths;
  }, [filteredNavigationGroups]);

  const isActive = useCallback((href?: string) => {
    if (!href) return false;
    if (href === '/') return pathname === '/';

    // Handle URLs with query strings (e.g., /contigo-labs?tab=rfx-studio)
    const [hrefPath, hrefQuery] = href.split('?');

    // Segment-safe prefix: `/admin` must not match via bare startsWith on `/admin-foo`
    const pathMatches =
      pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
    if (!pathMatches) return false;

    // Query-string targets: require exact path + matching params
    if (hrefQuery) {
      if (pathname !== hrefPath) return false;
      const hrefParams = new URLSearchParams(hrefQuery);
      for (const [key, value] of hrefParams.entries()) {
        if (searchParams.get(key) !== value) return false;
      }
      return true;
    }

    // Path-only targets: if a *more specific* registered nav path also matches
    // the current location, prefer that sibling (Organization vs UX Metrics).
    let bestPath = hrefPath;
    for (const candidate of navPathnames) {
      if (candidate.length <= bestPath.length) continue;
      if (pathname === candidate || pathname.startsWith(`${candidate}/`)) {
        bestPath = candidate;
      }
    }
    if (bestPath !== hrefPath) return false;

    // Contigo Labs parent (`/contigo-labs`) should not stay active when a tab
    // query selects a child entry.
    const currentTab = searchParams.get('tab');
    if (currentTab && pathname === hrefPath) return false;

    return true;
  }, [pathname, searchParams, navPathnames]);

  const isChildActive = useCallback((children?: NavigationItem[]): boolean => {
    return children?.some(child => child.href && isActive(child.href)) ?? false;
  }, [isActive]);

  useEffect(() => {
    const activeParents = filteredNavigationGroups.flatMap((group) =>
      group.items
        .filter((item) => Boolean(item.children?.length) && ((item.href && isActive(item.href)) || isChildActive(item.children)))
        .map((item) => item.name)
    );

    if (activeParents.length === 0) {
      return;
    }

    setExpandedItems((current) => Array.from(new Set([...current, ...activeParents])));
  }, [filteredNavigationGroups, isActive, isChildActive]);

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
      window.dispatchEvent(new CustomEvent('openAIChatbot', {
        detail: { autoMessage: 'Hi! How can I help you with your contracts today?' }
      }));
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
        <div className="flex items-center gap-2">
          <ConTigoLogoSVG size="md" />
          {isDemo && (
            <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
              DEMO
            </span>
          )}
        </div>
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
        id="main-nav"
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
            {isDemo && (
              <span className="ml-auto inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                DEMO
              </span>
            )}
          </div>

          {/* Search */}
          <div className="px-3 py-3">
            <form onSubmit={handleSearch}>
              <div className={cn(
                'relative transition-all duration-200 rounded-lg',
                searchFocused && 'ring-2 ring-violet-500/30'
              )}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="search"
                  data-search-input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  aria-label="Search"
                  className="w-full h-9 pl-9 pr-10 bg-gray-50/80 dark:bg-slate-800/80 border border-gray-200/60 dark:border-slate-600/60 rounded-lg text-sm placeholder:text-gray-400 dark:placeholder:text-slate-500 text-gray-900 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-violet-400 dark:focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                />
                <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:flex items-center px-1.5 py-0.5 text-[10px] text-gray-400 dark:text-slate-500 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded font-mono">
                  /
                </kbd>
              </div>
            </form>
          </div>

          {/* Demo Mode Toggle */}
          <div className="px-3 pb-2">
            <DemoModeToggle />
          </div>

          {/* Navigation Groups */}
          <nav className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-slate-600">
            {filteredNavigationGroups.map((group, groupIndex) => (
              <div key={group.id} className={cn(groupIndex > 0 && 'mt-5')}>
                <h3 className="px-3 mb-1.5 text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
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
                  <p>Keyboard shortcuts (?)</p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            {/* User */}
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white font-medium text-xs shadow-sm overflow-hidden">
                  {session?.user?.image ? (
                    
                    <Image src={session.user.image} alt={`${session.user.name || 'User'}'s profile photo`} width={32} height={32} className="w-full h-full object-cover" />
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
                  <motion.div key="user-menu"
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
                    <button
                      onClick={async () => {
                        setShowUserMenu(false);
                        const ok = await confirm(confirmPresets.logout());
                        if (ok) signOut({ callbackUrl: '/auth/signin' });
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                    >
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
          <motion.div key="mobile-menu-open"
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
