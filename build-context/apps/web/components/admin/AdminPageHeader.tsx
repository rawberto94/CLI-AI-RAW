'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ChevronRight, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconGradient?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  badge?: {
    label: string;
    variant?: 'default' | 'success' | 'warning' | 'error';
  };
}

const badgeVariants = {
  default: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export function AdminPageHeader({
  title,
  description,
  icon: Icon,
  iconGradient = 'from-violet-600 to-purple-600',
  breadcrumbs,
  actions,
  badge,
}: AdminPageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
          <Link 
            href="/admin" 
            className="hover:text-foreground transition-colors"
          >
            Admin
          </Link>
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              <ChevronRight className="h-4 w-4" />
              {crumb.href ? (
                <Link 
                  href={crumb.href}
                  className="hover:text-foreground transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {Icon && (
            <motion.div
              whileHover={{ scale: 1.05, rotate: 3 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className={cn(
                'p-3 rounded-xl bg-gradient-to-br text-white shadow-lg',
                iconGradient,
                `shadow-${iconGradient.split('-')[1]}-500/30`
              )}
            >
              <Icon className="h-6 w-6" />
            </motion.div>
          )}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {title}
              </h1>
              {badge && (
                <span className={cn(
                  'px-2.5 py-0.5 text-xs font-medium rounded-full',
                  badgeVariants[badge.variant || 'default']
                )}>
                  {badge.label}
                </span>
              )}
            </div>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </motion.div>
  );
}
