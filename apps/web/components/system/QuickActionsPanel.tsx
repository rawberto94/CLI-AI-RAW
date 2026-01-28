/**
 * Quick Actions Panel
 * Common actions available from the dashboard
 */

'use client';

import { memo } from 'react';
import Link from 'next/link';
import { 
  Upload, 
  Database, 
  FileSearch, 
  Brain,
  Zap,
  FileText,
  FolderSync,
  Settings,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface QuickAction {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}

const quickActions: QuickAction[] = [
  {
    id: 'upload',
    label: 'Upload Contract',
    description: 'Upload PDF, DOCX, or images',
    href: '/upload',
    icon: Upload,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50 hover:bg-violet-100',
    borderColor: 'border-violet-200',
  },
  {
    id: 'import-db',
    label: 'Import from Database',
    description: 'Connect to external databases',
    href: '/import/external-database',
    icon: Database,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50 hover:bg-violet-100',
    borderColor: 'border-violet-200',
  },
  {
    id: 'search',
    label: 'Smart Search',
    description: 'AI-powered contract search',
    href: '/search/advanced',
    icon: FileSearch,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50 hover:bg-violet-100',
    borderColor: 'border-violet-200',
  },
  {
    id: 'ai-chat',
    label: 'AI Assistant',
    description: 'Ask questions about contracts',
    href: '/ai/chat',
    icon: Brain,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 hover:bg-amber-100',
    borderColor: 'border-amber-200',
  },
];

const secondaryActions: QuickAction[] = [
  {
    id: 'rate-cards',
    label: 'Rate Cards',
    description: 'Manage pricing',
    href: '/rate-cards',
    icon: FileText,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50 hover:bg-slate-100',
    borderColor: 'border-slate-200',
  },
  {
    id: 'sync',
    label: 'Sync Settings',
    description: 'Configure syncs',
    href: '/settings/integrations',
    icon: FolderSync,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50 hover:bg-slate-100',
    borderColor: 'border-slate-200',
  },
];

export const QuickActionsPanel = memo(function QuickActionsPanel({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.id} href={action.href}>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'gap-2 rounded-lg border',
                  action.bgColor,
                  action.borderColor
                )}
              >
                <Icon className={cn('h-4 w-4', action.color)} />
                <span className="text-sm">{action.label}</span>
              </Button>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <Card className={cn('shadow-sm', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-500" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Actions */}
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.id} href={action.href}>
                <div
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-xl border transition-all',
                    'hover:shadow-md hover:-translate-y-0.5',
                    action.bgColor,
                    action.borderColor
                  )}
                >
                  <div
                    className={cn(
                      'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
                      'bg-white shadow-sm'
                    )}
                  >
                    <Icon className={cn('h-5 w-5', action.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-900">
                      {action.label}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {action.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Secondary Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          {secondaryActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.id} href={action.href} className="flex-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 text-slate-600 hover:text-slate-900"
                >
                  <Icon className="h-4 w-4" />
                  {action.label}
                </Button>
              </Link>
            );
          })}
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="h-4 w-4 text-slate-400" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
});

/**
 * Quick Actions Bar
 * Horizontal bar version for page headers
 */
export const QuickActionsBar = memo(function QuickActionsBar({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2 overflow-x-auto', className)}>
      {quickActions.map((action) => {
        const Icon = action.icon;
        return (
          <Link key={action.id} href={action.href}>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'gap-2 rounded-full border whitespace-nowrap',
                action.bgColor,
                action.borderColor,
                'hover:scale-105 transition-transform'
              )}
            >
              <Icon className={cn('h-4 w-4', action.color)} />
              <span>{action.label}</span>
              <ArrowRight className="h-3 w-3 opacity-50" />
            </Button>
          </Link>
        );
      })}
    </div>
  );
});
