'use client';

/**
 * Auto-generating Breadcrumbs
 * Automatically creates breadcrumbs from the current pathname
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Route Label Mappings
// ============================================================================

const ROUTE_LABELS: Record<string, string> = {
  // Root sections
  admin: 'Administration',
  contracts: 'Contracts',
  'rate-cards': 'Rate Cards',
  analytics: 'Analytics',
  governance: 'Governance',
  settings: 'Settings',
  workflows: 'Workflows',
  reports: 'Reports',
  import: 'Import',
  search: 'Search',
  templates: 'Templates',
  clauses: 'Clauses',
  benchmarks: 'Benchmarks',
  suppliers: 'Suppliers',
  monitoring: 'Monitoring',
  requests: 'Requests',
  generate: 'Generate',
  runs: 'Runs',
  jobs: 'Jobs',
  ai: 'AI',
  
  // Admin sub-routes
  users: 'Users',
  groups: 'Groups',
  departments: 'Departments',
  collaborators: 'External Collaborators',
  security: 'Security',
  integrations: 'Integrations',
  'ai-learning': 'AI Learning',
  'ab-testing': 'A/B Testing',
  'model-performance': 'Model Performance',
  ocr: 'OCR Review',
  queue: 'Queue',
  'job-monitor': 'Job Monitor',
  'legal-holds': 'Legal Holds',
  dlp: 'DLP Policies',
  records: 'Records Management',
  sso: 'SSO Configuration',
  'api-keys': 'API Keys',
  'ai-governance': 'AI Governance',
  
  // Contract sub-routes
  'ai-draft': 'AI Draft',
  archive: 'Archive',
  bulk: 'Bulk Operations',
  new: 'New Contract',
  upload: 'Upload',
  enhanced: 'Enhanced View',
  esign: 'E-Signature',
  'legal-review': 'Legal Review',
  negotiate: 'Negotiate',
  redline: 'Redline',
  renew: 'Renewal',
  sign: 'Sign',
  'state-of-the-art': 'SOTA View',
  store: 'Store',
  terminate: 'Termination',
  versions: 'Version History',
  compare: 'Compare Versions',
  workflow: 'Workflow',
  
  // Rate cards sub-routes
  alerts: 'Alerts',
  anomalies: 'Anomalies',
  'baseline-comparison': 'Baseline Comparison',
  baselines: 'Baselines',
  'baseline-tracking': 'Baseline Tracking',
  'best-rates': 'Best Rates',
  clustering: 'Clustering',
  comparison: 'Comparison',
  'competitive-intelligence': 'Competitive Intelligence',
  forecasts: 'Forecasts',
  'market-intelligence': 'Market Intelligence',
  entries: 'Rate Entries',
  trends: 'Trends',
  opportunities: 'Opportunities',
  
  // Analytics sub-routes
  artifacts: 'Artifacts',
  compliance: 'Compliance',
  documents: 'Documents',
  procurement: 'Procurement Intelligence',
  'rate-compliance': 'Rate Compliance',
  system: 'System Analytics',
  
  // Governance sub-routes
  delegation: 'Delegation of Authority',
  'pre-approval-gates': 'Pre-Approval Gates',
  'routing-rules': 'Routing Rules',
  'signature-policies': 'Signature Policies',
  
  // Settings sub-routes
  metadata: 'Custom Metadata',
  taxonomy: 'Taxonomy',
  notifications: 'Notifications',
  
  // Workflows sub-routes
  escalation: 'Escalation Rules',
  sla: 'SLA Management',
  designer: 'Workflow Designer',
  
  // Reports sub-routes
  'ai-builder': 'AI Report Builder',
  builder: 'Report Builder',
  scheduled: 'Scheduled Reports',
  
  // Import sub-routes
  'external-database': 'External Database',
  history: 'Import History',
  wizard: 'Import Wizard',
  
  // Search sub-routes
  advanced: 'Advanced Search',
  saved: 'Saved Searches',
  
  // Other
  activity: 'Activity',
  chat: 'AI Chat',
  performance: 'Performance',
  'ai-tools': 'AI Tools',
  observability: 'Observability',
  agents: 'Agents',
};

// ============================================================================
// Types
// ============================================================================

interface BreadcrumbItem {
  label: string;
  href: string;
  isCurrent: boolean;
}

interface BreadcrumbItemWithKey extends BreadcrumbItem {
  _key: string;
}

interface AutoBreadcrumbsProps {
  /** Override home label (default: "Home") */
  homeLabel?: string;
  /** Override home href (default: "/dashboard") */
  homeHref?: string;
  /** Custom label overrides for specific segments */
  labelOverrides?: Record<string, string>;
  /** Hide home breadcrumb */
  hideHome?: boolean;
  /** Custom class name */
  className?: string;
  /** Maximum visible items before collapsing */
  maxItems?: number;
  /** Show icons for known routes */
  showIcons?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function AutoBreadcrumbs({
  homeLabel = 'Home',
  homeHref = '/dashboard',
  labelOverrides = {},
  hideHome = false,
  className,
  maxItems = 5,
}: AutoBreadcrumbsProps) {
  const pathname = usePathname();
  
  // Parse pathname into breadcrumb items
  const items = React.useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];
    
    // Add home
    if (!hideHome) {
      breadcrumbs.push({
        label: homeLabel,
        href: homeHref,
        isCurrent: pathname === homeHref || pathname === '/',
      });
    }
    
    // Build path progressively
    let currentPath = '';
    segments.forEach((segment, index) => {
      // Skip dynamic route patterns like [id]
      const isLast = index === segments.length - 1;
      currentPath += `/${segment}`;
      
      // Skip route groups like (authenticated), (dashboard), (marketing)
      if (segment.startsWith('(') && segment.endsWith(')')) {
        return;
      }
      
      // Get label - check overrides first, then mappings, then format segment
      const label = labelOverrides[segment] 
        || ROUTE_LABELS[segment] 
        || formatSegment(segment);
      
      breadcrumbs.push({
        label,
        href: currentPath,
        isCurrent: isLast,
      });
    });
    
    return breadcrumbs;
  }, [pathname, homeLabel, homeHref, hideHome, labelOverrides]);
  
  // Don't render if only home or less
  if (items.length <= 1) {
    return null;
  }
  
  // Handle collapsed state for too many items
  const visibleItems: BreadcrumbItemWithKey[] = items.length > maxItems
    ? [
        { ...items[0], _key: 'home' },
        { label: '...', href: '', isCurrent: false, _key: 'ellipsis' },
        ...items.slice(-2).map((item, i) => ({ ...item, _key: `tail-${i}` }))
      ]
    : items.map((item, i) => ({ ...item, _key: `item-${i}` }));
  
  return (
    <nav 
      aria-label="Breadcrumb" 
      className={cn('flex items-center text-sm mb-4', className)}
    >
      <ol className="flex items-center space-x-1">
        {visibleItems.map((item, index) => (
          <li key={item._key} className="flex items-center">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-slate-400 mx-1 flex-shrink-0" aria-hidden="true" />
            )}
            
            {item.label === '...' ? (
              <span className="text-slate-400 px-1">...</span>
            ) : item.isCurrent ? (
              <motion.span
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]"
                aria-current="page"
              >
                {item.label}
              </motion.span>
            ) : (
              <motion.span
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  href={item.href}
                  className={cn(
                    'text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400',
                    'transition-colors truncate max-w-[150px] inline-flex items-center gap-1',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 rounded'
                  )}
                >
                  {index === 0 && !hideHome && <Home className="h-4 w-4" />}
                  {item.label}
                </Link>
              </motion.span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatSegment(segment: string): string {
  // Handle UUIDs - shorten them
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
    return `#${segment.slice(0, 8)}`;
  }
  
  // Handle numeric IDs
  if (/^\d+$/.test(segment)) {
    return `#${segment}`;
  }
  
  // Handle bracket patterns like [id]
  if (segment.startsWith('[') && segment.endsWith(']')) {
    return 'Details';
  }
  
  // Convert kebab-case or snake_case to Title Case
  return segment
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export default AutoBreadcrumbs;
