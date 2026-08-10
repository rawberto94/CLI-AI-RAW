'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { AutoBreadcrumbs } from '@/components/navigation/AutoBreadcrumbs';
import {
  LayoutDashboard,
  Users,
  UsersRound,
  Building2,
  ExternalLink,
  Shield,
  Settings,
  Plug,
  ListTodo,
  ChevronLeft,
  Brain,
  FlaskConical,
  Cpu,
  ScanText,
  PanelLeftClose,
  PanelLeft,
  Search,
  Keyboard,
  BarChart3,
  LineChart,
  Key,
  Gavel,
  ScrollText,
  Activity,
  Gauge,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AdminNavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

interface AdminNavGroup {
  label: string | null;
  items: AdminNavItem[];
}

// This is the single source of truth for admin navigation. The main app rail
// (components/layout/EnhancedNavigation.tsx) intentionally links only to /admin
// rather than mirroring these sections.
const adminNavGroups: AdminNavGroup[] = [
  {
    label: null,
    items: [
      { title: 'Overview', href: '/admin', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: 'People & Access',
    items: [
      { title: 'Users', href: '/admin/users', icon: Users },
      { title: 'Groups', href: '/admin/groups', icon: UsersRound },
      { title: 'Departments', href: '/admin/departments', icon: Building2 },
      { title: 'External Collaborators', href: '/admin/collaborators', icon: ExternalLink },
    ],
  },
  {
    label: 'Security & Compliance',
    items: [
      { title: 'Security', href: '/admin/security', icon: Shield },
      { title: 'SSO', href: '/admin/sso', icon: Key },
      { title: 'Legal Holds', href: '/admin/legal-holds', icon: Gavel },
      { title: 'Audit Logs', href: '/audit-logs', icon: ScrollText },
    ],
  },
  {
    label: 'Operations',
    items: [
      { title: 'Integrations', href: '/admin/integrations', icon: Plug },
      { title: 'Queue', href: '/admin/queue', icon: ListTodo },
      { title: 'Job Monitor', href: '/admin/job-monitor', icon: Activity },
      { title: 'OCR Review', href: '/admin/ocr', icon: ScanText },
    ],
  },
  {
    label: 'AI',
    items: [
      { title: 'AI Learning', href: '/admin/ai-learning', icon: Brain },
      { title: 'Model Performance', href: '/admin/model-performance', icon: Cpu },
      { title: 'A/B Testing', href: '/admin/ab-testing', icon: FlaskConical },
      { title: 'RAG Quality', href: '/admin/rag-eval', icon: Gauge },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { title: 'Upload Metrics', href: '/admin/upload-metrics', icon: BarChart3 },
      { title: 'UX Metrics', href: '/admin/ux-metrics', icon: LineChart },
    ],
  },
  {
    label: null,
    items: [
      { title: 'Settings', href: '/admin/settings', icon: Settings },
    ],
  },
];

const adminNavItems = adminNavGroups.flatMap((group) => group.items);

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return adminNavItems;
    return adminNavItems.filter((item) => item.title.toLowerCase().includes(q));
  }, [searchQuery]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + B to toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setCollapsed(prev => !prev);
      }
      // Cmd/Ctrl + K to open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchQuery('');
        setSearchOpen(true);
      }
      // Escape to close search
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  const isActive = (item: AdminNavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className={cn(
          'border-r bg-muted/30 flex flex-col transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}>
          <div className="p-2 border-b flex items-center justify-between gap-2">
            {!collapsed && (
              <Link href="/dashboard" className="flex-1">
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setCollapsed(!collapsed)}
                  className="shrink-0"
                >
                  {collapsed ? (
                    <PanelLeft className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {collapsed ? 'Expand sidebar' : 'Collapse sidebar'} (⌘B)
              </TooltipContent>
            </Tooltip>
          </div>
          
          {!collapsed && (
            <div className="p-4">
              <h2 className="text-lg font-semibold mb-1">Administration</h2>
              <p className="text-sm text-muted-foreground">Manage your organization</p>
            </div>
          )}

          {/* Quick Search Button */}
          {!collapsed && (
            <div className="px-3 mb-2">
              <Button 
                variant="outline" 
                className="w-full justify-start text-muted-foreground"
                onClick={() => { setSearchQuery(''); setSearchOpen(true); }}
              >
                <Search className="h-4 w-4 mr-2" />
                <span>Quick search...</span>
                <kbd className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
              </Button>
            </div>
          )}

          <nav className="flex-1 overflow-y-auto px-2 pb-4">
            {adminNavGroups.map((group, groupIndex) => (
              <div key={group.label ?? `group-${groupIndex}`} className={groupIndex > 0 ? 'mt-4' : undefined}>
                {group.label && !collapsed && (
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {group.label}
                  </p>
                )}
                {group.label && collapsed && groupIndex > 0 && (
                  <div className="mx-2 mb-2 border-t" />
                )}
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item);

                    const NavItem = (
                      <Link key={item.href} href={item.href}>
                        <div
                          className={cn(
                            'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors',
                            collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2',
                            active
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {!collapsed && item.title}
                        </div>
                      </Link>
                    );

                    if (collapsed) {
                      return (
                        <Tooltip key={item.href}>
                          <TooltipTrigger asChild>
                            {NavItem}
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            {item.title}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }

                    return NavItem;
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className={cn(
            'border-t',
            collapsed ? 'p-2' : 'p-4'
          )}>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-full">
                    <Keyboard className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div className="text-xs space-y-1">
                    <p><kbd className="bg-muted px-1 rounded">⌘B</kbd> Toggle sidebar</p>
                    <p><kbd className="bg-muted px-1 rounded">⌘K</kbd> Quick search</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-2">
                  Organization: <span className="font-medium">Your Company</span>
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Keyboard className="h-3 w-3" />
                  <kbd className="bg-muted px-1 rounded">⌘B</kbd> sidebar
                  <kbd className="bg-muted px-1 rounded ml-1">⌘K</kbd> search
                </p>
              </>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-background p-6">
          <AutoBreadcrumbs homeHref="/admin" homeLabel="Admin" />
          {children}
        </main>

        {/* Quick Search Modal */}
        {searchOpen && (
          <div 
            className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[20vh]"
            onClick={() => setSearchOpen(false)}
          >
            <div 
              className="bg-background rounded-lg shadow-2xl w-full max-w-lg border"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b">
                <Search className="h-5 w-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search admin pages..."
                  className="flex-1 bg-transparent outline-none text-lg"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <kbd className="text-xs bg-muted px-2 py-1 rounded">ESC</kbd>
              </div>
              <div className="p-2 max-h-80 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No admin pages match &ldquo;{searchQuery}&rdquo;
                  </p>
                ) : (
                  searchResults.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span>{item.title}</span>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
