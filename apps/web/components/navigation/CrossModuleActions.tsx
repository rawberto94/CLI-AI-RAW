'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  ArrowRight,
  ExternalLink,
  Zap,
  Activity,
  Calendar,
  CheckCircle2,
  Shield,
  Edit3,
  FileText,
  TrendingUp,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface QuickAction {
  id: string;
  label: string;
  description?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'primary' | 'secondary' | 'warning' | 'danger' | 'success';
  badge?: string;
  external?: boolean;
}

interface CrossModuleActionsProps {
  title?: string;
  actions: QuickAction[];
  layout?: 'horizontal' | 'vertical' | 'grid';
  compact?: boolean;
}

// ============================================================================
// Variant Styles
// ============================================================================

const variantStyles = {
  primary: {
    container: 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100 hover:border-blue-200',
    icon: 'bg-blue-100 text-blue-600',
    text: 'text-blue-900',
    description: 'text-blue-600',
    arrow: 'text-blue-400 group-hover:text-blue-600',
  },
  secondary: {
    container: 'bg-slate-50 border-slate-200 hover:border-slate-300',
    icon: 'bg-slate-100 text-slate-600',
    text: 'text-slate-900',
    description: 'text-slate-500',
    arrow: 'text-slate-400 group-hover:text-slate-600',
  },
  warning: {
    container: 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-100 hover:border-amber-200',
    icon: 'bg-amber-100 text-amber-600',
    text: 'text-amber-900',
    description: 'text-amber-600',
    arrow: 'text-amber-400 group-hover:text-amber-600',
  },
  danger: {
    container: 'bg-gradient-to-r from-red-50 to-rose-50 border-red-100 hover:border-red-200',
    icon: 'bg-red-100 text-red-600',
    text: 'text-red-900',
    description: 'text-red-600',
    arrow: 'text-red-400 group-hover:text-red-600',
  },
  success: {
    container: 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-100 hover:border-green-200',
    icon: 'bg-green-100 text-green-600',
    text: 'text-green-900',
    description: 'text-green-600',
    arrow: 'text-green-400 group-hover:text-green-600',
  },
};

// ============================================================================
// Cross Module Actions Component
// ============================================================================

export function CrossModuleActions({
  title,
  actions,
  layout = 'horizontal',
  compact = false,
}: CrossModuleActionsProps) {
  const layoutStyles = {
    horizontal: 'flex flex-wrap gap-3',
    vertical: 'flex flex-col gap-2',
    grid: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      {title && (
        <h3 className="text-xs font-medium text-slate-500 uppercase mb-3 flex items-center gap-2">
          <Zap className="h-3.5 w-3.5" />
          {title}
        </h3>
      )}
      
      <div className={layoutStyles[layout]}>
        {actions.map((action) => {
          const styles = variantStyles[action.variant || 'secondary'];
          const Icon = action.icon;
          
          return (
            <Link
              key={action.id}
              href={action.href}
              target={action.external ? '_blank' : undefined}
              rel={action.external ? 'noopener noreferrer' : undefined}
              className={`group flex items-center gap-3 ${
                compact ? 'px-3 py-2' : 'px-4 py-3'
              } rounded-lg border transition-all hover:shadow-sm ${styles.container}`}
            >
              <div className={`${compact ? 'p-1.5' : 'p-2'} rounded-lg ${styles.icon}`}>
                <Icon className={`${compact ? 'h-4 w-4' : 'h-5 w-5'}`} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${compact ? 'text-sm' : ''} ${styles.text}`}>
                    {action.label}
                  </span>
                  {action.badge && (
                    <span className="px-1.5 py-0.5 text-xs font-medium bg-white/50 rounded-full">
                      {action.badge}
                    </span>
                  )}
                </div>
                {action.description && !compact && (
                  <p className={`text-sm ${styles.description} truncate`}>
                    {action.description}
                  </p>
                )}
              </div>
              
              {action.external ? (
                <ExternalLink className={`h-4 w-4 ${styles.arrow}`} />
              ) : (
                <ChevronRight className={`h-4 w-4 ${styles.arrow}`} />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Module Summary Card
// ============================================================================

interface ModuleSummaryCard {
  title: string;
  value: string | number;
  change?: {
    value: number;
    direction: 'up' | 'down';
  };
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

interface ModuleSummaryProps {
  cards: ModuleSummaryCard[];
}

export function ModuleSummary({ cards }: ModuleSummaryProps) {
  const cardVariants = {
    default: 'bg-white',
    success: 'bg-gradient-to-br from-green-50 to-emerald-50',
    warning: 'bg-gradient-to-br from-amber-50 to-orange-50',
    danger: 'bg-gradient-to-br from-red-50 to-rose-50',
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const variant = cardVariants[card.variant || 'default'];
        
        return (
          <Link
            key={index}
            href={card.href}
            className={`${variant} rounded-xl border border-slate-200 p-4 hover:shadow-lg transition-shadow group`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-white/80 rounded-lg shadow-sm">
                <Icon className="h-5 w-5 text-slate-600" />
              </div>
              {card.change && (
                <div className={`flex items-center text-xs font-medium ${
                  card.change.direction === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  <TrendingUp className={`h-3 w-3 mr-0.5 ${
                    card.change.direction === 'down' ? 'rotate-180' : ''
                  }`} />
                  {Math.abs(card.change.value)}%
                </div>
              )}
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{card.value}</div>
              <div className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                {card.title}
                <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ============================================================================
// Preset Action Sets for Common Module Transitions
// ============================================================================

export const healthScoreActions: QuickAction[] = [
  {
    id: 'manage-renewal',
    label: 'Manage Renewal',
    description: 'Review and process renewals',
    href: '/renewals',
    icon: Calendar,
    variant: 'warning',
  },
  {
    id: 'request-approval',
    label: 'Request Approval',
    description: 'Submit for approval',
    href: '/approvals',
    icon: CheckCircle2,
    variant: 'primary',
  },
  {
    id: 'review-governance',
    label: 'Review Policies',
    description: 'Check compliance',
    href: '/governance',
    icon: Shield,
    variant: 'secondary',
  },
  {
    id: 'edit-draft',
    label: 'Edit Contract',
    description: 'Open in drafting canvas',
    href: '/drafting',
    icon: Edit3,
    variant: 'success',
  },
];

export const approvalActions: QuickAction[] = [
  {
    id: 'view-contract',
    label: 'View Contract',
    description: 'Open contract details',
    href: '/contracts',
    icon: FileText,
    variant: 'primary',
  },
  {
    id: 'check-health',
    label: 'Check Health',
    description: 'View health score',
    href: '/intelligence/health',
    icon: Activity,
    variant: 'secondary',
  },
  {
    id: 'review-policies',
    label: 'Review Policies',
    description: 'Check governance rules',
    href: '/governance',
    icon: Shield,
    variant: 'warning',
  },
];

export const renewalActions: QuickAction[] = [
  {
    id: 'forecast-impact',
    label: 'Forecast Impact',
    description: 'View financial projections',
    href: '/forecast',
    icon: TrendingUp,
    variant: 'primary',
  },
  {
    id: 'check-health',
    label: 'Health Score',
    description: 'Review contract health',
    href: '/intelligence/health',
    icon: Activity,
    variant: 'secondary',
  },
  {
    id: 'request-approval',
    label: 'Request Approval',
    description: 'Submit renewal decision',
    href: '/approvals',
    icon: CheckCircle2,
    variant: 'success',
  },
];

export default CrossModuleActions;
