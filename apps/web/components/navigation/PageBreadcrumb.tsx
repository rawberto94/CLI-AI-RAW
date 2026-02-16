'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  Home,
  FileText,
  Upload,
  BarChart3,
  CreditCard,
  Sparkles,
  Zap,
  CheckCircle2,
  Calendar,
  TrendingUp,
  Edit3,
  Building2,
  Link2,
  Shield,
  Search,
  Activity,
  Target,
  Briefcase,
  LayoutDashboard,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface BreadcrumbItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  current?: boolean;
}

interface PageBreadcrumbProps {
  items?: BreadcrumbItem[];
  showHome?: boolean;
  className?: string;
}

// ============================================================================
// Route to Breadcrumb Mapping
// ============================================================================

const ROUTE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  '/': { label: 'Dashboard', icon: Home },
  '/contracts': { label: 'Contracts', icon: FileText },
  '/upload': { label: 'Upload', icon: Upload },
  '/dashboard': { label: 'Analytics', icon: BarChart3 },
  '/analytics': { label: 'Analytics', icon: BarChart3 },
  '/rate-cards': { label: 'Rate Cards', icon: CreditCard },
  '/rate-cards/dashboard': { label: 'Dashboard', icon: LayoutDashboard },
  '/rate-cards/entries': { label: 'Entries', icon: FileText },
  '/rate-cards/benchmarking': { label: 'Benchmarking', icon: Target },
  '/rate-cards/opportunities': { label: 'Opportunities', icon: TrendingUp },
  '/generate': { label: 'Generate', icon: Sparkles },
  '/generate/templates': { label: 'Templates', icon: FileText },
  '/generate/workflows': { label: 'Workflows', icon: Activity },
  '/intelligence': { label: 'Intelligence', icon: Zap },
  '/intelligence/graph': { label: 'Knowledge Graph', icon: Activity },
  '/intelligence/health': { label: 'Health Scores', icon: Target },
  '/intelligence/search': { label: 'AI Search', icon: Search },
  '/intelligence/negotiate': { label: 'Negotiation', icon: Briefcase },
  '/approvals': { label: 'Approvals', icon: CheckCircle2 },
  '/renewals': { label: 'Renewals', icon: Calendar },
  '/forecast': { label: 'Forecast', icon: TrendingUp },
  '/drafting': { label: 'Drafting', icon: Edit3 },
  '/portal': { label: 'Portal', icon: Building2 },
  '/integrations': { label: 'Integrations', icon: Link2 },
  '/governance': { label: 'Governance', icon: Shield },
  '/search': { label: 'Search', icon: Search },
  // New routes
  '/ai': { label: 'AI', icon: Sparkles },
  '/ai/chat': { label: 'AI Assistant', icon: Sparkles },
  '/compare': { label: 'Compare', icon: FileText },
  '/notifications': { label: 'Notifications', icon: Activity },
  '/settings': { label: 'Settings', icon: Shield },
  '/settings/profile': { label: 'Profile', icon: Building2 },
  '/settings/notifications': { label: 'Notifications', icon: Activity },
  '/settings/taxonomy': { label: 'Taxonomy', icon: Target },
  '/settings/metadata': { label: 'Metadata', icon: FileText },
  '/templates': { label: 'Templates', icon: FileText },
  '/workflows': { label: 'Workflows', icon: Activity },
  '/deadlines': { label: 'Deadlines', icon: Calendar },
  '/risk': { label: 'Risk', icon: Shield },
  '/suppliers': { label: 'Suppliers', icon: Building2 },
  '/clauses': { label: 'Clauses', icon: FileText },
  '/team': { label: 'Team', icon: Building2 },
  '/compliance': { label: 'Compliance', icon: Shield },
  '/benchmarks': { label: 'Benchmarks', icon: Target },
  '/automation': { label: 'Automation', icon: Zap },
  '/monitoring': { label: 'Monitoring', icon: Activity },
  '/jobs': { label: 'Jobs', icon: Activity },
  '/runs': { label: 'Runs', icon: Activity },
  '/obligations': { label: 'Obligations', icon: Target },
  '/drafting/copilot': { label: 'AI Copilot', icon: Sparkles },
  '/contracts/upload': { label: 'Upload', icon: Upload },
  // Contract-specific routes (dynamic)
  '/legal-review': { label: 'Legal Review', icon: Shield },
  '/redline': { label: 'Redline Editor', icon: Edit3 },
  '/renewal': { label: 'Renewal', icon: Calendar },
  '/amendment': { label: 'Amendment', icon: FileText },
};

// ============================================================================
// Component
// ============================================================================

export function PageBreadcrumb({ items, showHome = true, className = '' }: PageBreadcrumbProps) {
  const pathname = usePathname();

  // Auto-generate breadcrumbs from pathname if not provided
  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    if (items) return items;

    const pathParts = pathname.split('/').filter(Boolean);
    const crumbs: BreadcrumbItem[] = [];

    if (showHome && pathname !== '/') {
      crumbs.push({
        label: 'Home',
        href: '/',
        icon: Home,
        current: false,
      });
    }

    let currentPath = '';
    pathParts.forEach((part, index) => {
      currentPath += `/${part}`;
      const config = ROUTE_CONFIG[currentPath];
      
      if (config) {
        crumbs.push({
          label: config.label,
          href: currentPath,
          icon: config.icon,
          current: index === pathParts.length - 1,
        });
      } else if (index === pathParts.length - 1) {
        // Dynamic route - try to get a clean label
        const label = part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' ');
        crumbs.push({
          label,
          href: currentPath,
          current: true,
        });
      }
    });

    return crumbs;
  }, [pathname, items, showHome]);

  if (breadcrumbs.length === 0) return null;

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center space-x-1 text-sm ${className}`}
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center space-x-1 bg-white/60 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/50 shadow-sm">
        {breadcrumbs.map((crumb, index) => {
          const Icon = crumb.icon;
          const isLast = index === breadcrumbs.length - 1;

          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="h-4 w-4 text-slate-300 mx-1.5 flex-shrink-0" />
              )}
              
              {isLast ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 text-slate-800 font-semibold bg-gradient-to-r from-slate-100 to-slate-50 rounded-lg shadow-sm">
                  {Icon && <Icon className="h-3.5 w-3.5 text-violet-600" />}
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="flex items-center gap-1.5 px-2 py-1 text-slate-500 hover:text-violet-600 hover:bg-violet-50/50 rounded-lg transition-all duration-200"
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </motion.nav>
  );
}

// ============================================================================
// Related Modules Component
// ============================================================================

interface RelatedModule {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeColor?: string;
}

interface RelatedModulesProps {
  modules: RelatedModule[];
  title?: string;
}

export function RelatedModules({ modules, title = 'Related Modules' }: RelatedModulesProps) {
  if (modules.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <h3 className="text-xs font-medium text-slate-500 uppercase mb-3">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {modules.map((module, index) => {
          const Icon = module.icon;
          return (
            <Link
              key={`${module.label}-${index}`}
              href={module.href}
              className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors group"
            >
              <Icon className="h-4 w-4 text-slate-500 group-hover:text-violet-500" />
              <span className="text-sm text-slate-700 group-hover:text-slate-900">{module.label}</span>
              {module.badge !== undefined && (
                <span className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${module.badgeColor || 'bg-violet-100 text-violet-700'}`}>
                  {module.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Cross Module Action Button
// ============================================================================

interface CrossModuleActionProps {
  label: string;
  description?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'primary' | 'secondary' | 'warning' | 'danger';
}

export function CrossModuleAction({
  label,
  description,
  href,
  icon: Icon,
  variant = 'primary',
}: CrossModuleActionProps) {
  const variants = {
    primary: 'bg-violet-500 hover:bg-violet-600 text-white',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white',
    danger: 'bg-red-500 hover:bg-red-600 text-white',
  };

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${variants[variant]}`}
    >
      <Icon className="h-5 w-5" />
      <div>
        <span className="font-medium">{label}</span>
        {description && (
          <p className="text-sm opacity-80">{description}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 ml-auto" />
    </Link>
  );
}

// ============================================================================
// Page Header Component
// ============================================================================

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  badge?: {
    label: string;
    variant?: 'new' | 'beta' | 'updated';
  };
}

export function PageHeader({ title, description, icon: Icon, actions, badge }: PageHeaderProps) {
  const badgeStyles = {
    new: 'bg-green-100 text-green-700 border-green-200',
    beta: 'bg-violet-100 text-violet-700 border-violet-200',
    updated: 'bg-violet-100 text-violet-700 border-violet-200',
  };

  return (
    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/20">
            <Icon className="h-6 w-6 text-white" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
            {badge && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${badgeStyles[badge.variant || 'new']}`}>
                {badge.label}
              </span>
            )}
          </div>
          {description && (
            <p className="text-sm text-slate-500 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

export default PageBreadcrumb;
