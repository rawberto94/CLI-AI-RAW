'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const adminNavItems = [
  {
    title: 'Overview',
    href: '/admin',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    title: 'Users',
    href: '/admin/users',
    icon: Users,
  },
  {
    title: 'Groups',
    href: '/admin/groups',
    icon: UsersRound,
  },
  {
    title: 'Departments',
    href: '/admin/departments',
    icon: Building2,
  },
  {
    title: 'External Collaborators',
    href: '/admin/collaborators',
    icon: ExternalLink,
  },
  {
    title: 'Security',
    href: '/admin/security',
    icon: Shield,
  },
  {
    title: 'Integrations',
    href: '/admin/integrations',
    icon: Plug,
  },
  {
    title: 'AI Learning',
    href: '/admin/ai-learning',
    icon: Brain,
  },
  {
    title: 'A/B Testing',
    href: '/admin/ab-testing',
    icon: FlaskConical,
  },
  {
    title: 'Model Performance',
    href: '/admin/model-performance',
    icon: Cpu,
  },
  {
    title: 'Queue',
    href: '/admin/queue',
    icon: ListTodo,
  },
  {
    title: 'Settings',
    href: '/admin/settings',
    icon: Settings,
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isActive = (item: typeof adminNavItems[0]) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="w-full justify-start">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-1">Administration</h2>
          <p className="text-sm text-muted-foreground">Manage your organization</p>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);

            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.title}
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t">
          <p className="text-xs text-muted-foreground">
            Organization: <span className="font-medium">Your Company</span>
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background">
        {children}
      </main>
    </div>
  );
}
