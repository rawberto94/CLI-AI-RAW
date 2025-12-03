'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Download,
  Share2,
  Send,
  FileEdit,
  GitCompare,
  Brain,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Printer,
  Mail,
  CalendarPlus,
  Bell,
  Copy,
  ExternalLink,
  Sparkles,
  FileText,
  Shield,
  DollarSign,
  Users,
  ChevronRight,
  X,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface QuickAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  badge?: string;
  isNew?: boolean;
  isPremium?: boolean;
}

interface QuickActionsPanelProps {
  contractId: string;
  contractTitle: string;
  contractStatus: string;
  onShare?: () => void;
  onDownload?: () => void;
  onEdit?: () => void;
  onCompare?: () => void;
  onAnalyze?: () => void;
  onApproval?: () => void;
  onReminder?: () => void;
  onExport?: (format: string) => void;
  className?: string;
}

// ============================================================================
// Quick Action Button
// ============================================================================

function QuickActionButton({
  action,
  isCompact = false,
}: {
  action: QuickAction;
  isCompact?: boolean;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const Icon = action.icon;

  const handleClick = async () => {
    if (action.disabled) return;
    setIsLoading(true);
    try {
      await action.onClick();
    } finally {
      setIsLoading(false);
    }
  };

  if (isCompact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleClick}
              disabled={action.disabled || isLoading}
              className={cn(
                "relative p-3 rounded-xl transition-all duration-200",
                "hover:shadow-lg",
                action.bgColor,
                action.disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <Loader2 className={cn("w-5 h-5 animate-spin", action.color)} />
              ) : (
                <Icon className={cn("w-5 h-5", action.color)} />
              )}
              {action.isNew && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              )}
              {action.isPremium && (
                <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-amber-500" />
              )}
            </motion.button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="font-medium">{action.label}</p>
            {action.description && (
              <p className="text-xs text-slate-400">{action.description}</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      disabled={action.disabled || isLoading}
      className={cn(
        "flex items-center gap-3 w-full p-3 rounded-xl transition-all duration-200",
        "hover:shadow-md group",
        action.bgColor,
        action.disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <div className={cn("p-2 rounded-lg", action.bgColor, "bg-opacity-50")}>
        {isLoading ? (
          <Loader2 className={cn("w-5 h-5 animate-spin", action.color)} />
        ) : (
          <Icon className={cn("w-5 h-5", action.color)} />
        )}
      </div>
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-slate-900">{action.label}</span>
          {action.badge && (
            <Badge variant="secondary" className="text-xs h-5">
              {action.badge}
            </Badge>
          )}
          {action.isNew && (
            <Badge className="bg-blue-500 text-white text-xs h-5">New</Badge>
          )}
          {action.isPremium && (
            <Sparkles className="w-3 h-3 text-amber-500" />
          )}
        </div>
        {action.description && (
          <p className="text-xs text-slate-500 mt-0.5">{action.description}</p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function QuickActionsPanel({
  contractId,
  contractTitle,
  contractStatus,
  onShare,
  onDownload,
  onEdit,
  onCompare,
  onAnalyze,
  onApproval,
  onReminder,
  onExport,
  className,
}: QuickActionsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const primaryActions: QuickAction[] = [
    {
      id: 'analyze',
      label: 'AI Analysis',
      description: 'Get AI-powered insights',
      icon: Brain,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 hover:bg-purple-100',
      onClick: () => onAnalyze?.() || toast.info('AI analysis started'),
      isPremium: true,
    },
    {
      id: 'share',
      label: 'Share Contract',
      description: 'Share with team or external parties',
      icon: Share2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 hover:bg-blue-100',
      onClick: () => onShare?.(),
    },
    {
      id: 'download',
      label: 'Download',
      description: 'Export as PDF, DOCX, or JSON',
      icon: Download,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 hover:bg-emerald-100',
      onClick: () => onDownload?.() || toast.info('Download started'),
    },
  ];

  const secondaryActions: QuickAction[] = [
    {
      id: 'edit',
      label: 'Edit Metadata',
      icon: FileEdit,
      color: 'text-slate-600',
      bgColor: 'bg-slate-50 hover:bg-slate-100',
      onClick: () => onEdit?.(),
    },
    {
      id: 'compare',
      label: 'Compare Versions',
      icon: GitCompare,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 hover:bg-indigo-100',
      onClick: () => onCompare?.(),
      isNew: true,
    },
    {
      id: 'approval',
      label: 'Request Approval',
      icon: Send,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 hover:bg-amber-100',
      onClick: () => onApproval?.(),
      disabled: contractStatus === 'approved',
      badge: contractStatus === 'approved' ? 'Approved' : undefined,
    },
    {
      id: 'reminder',
      label: 'Set Reminder',
      icon: Bell,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50 hover:bg-rose-100',
      onClick: () => onReminder?.() || toast.info('Reminder dialog opened'),
    },
  ];

  const exportActions: QuickAction[] = [
    {
      id: 'print',
      label: 'Print',
      icon: Printer,
      color: 'text-slate-600',
      bgColor: 'bg-slate-50 hover:bg-slate-100',
      onClick: () => window.print(),
    },
    {
      id: 'email',
      label: 'Email',
      icon: Mail,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 hover:bg-blue-100',
      onClick: () => {
        const subject = encodeURIComponent(`Contract: ${contractTitle}`);
        window.open(`mailto:?subject=${subject}`);
      },
    },
    {
      id: 'calendar',
      label: 'Add to Calendar',
      icon: CalendarPlus,
      color: 'text-green-600',
      bgColor: 'bg-green-50 hover:bg-green-100',
      onClick: () => toast.info('Calendar event created'),
    },
    {
      id: 'copy-link',
      label: 'Copy Link',
      icon: Copy,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 hover:bg-purple-100',
      onClick: () => {
        navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard');
      },
    },
  ];

  return (
    <Card className={cn("shadow-sm border-slate-200/50 overflow-hidden", className)}>
      <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
              <Zap className="w-4 h-4 text-white" />
            </div>
            Quick Actions
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0"
          >
            <motion.div
              animate={{ rotate: isExpanded ? 0 : 180 }}
              transition={{ duration: 0.2 }}
            >
              <X className="w-4 h-4 text-slate-400" />
            </motion.div>
          </Button>
        </div>
      </CardHeader>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="space-y-4 pb-4">
              {/* Primary Actions - Featured */}
              <div className="space-y-2">
                {primaryActions.map((action) => (
                  <QuickActionButton key={action.id} action={action} />
                ))}
              </div>

              {/* Secondary Actions - Grid */}
              <div className="grid grid-cols-2 gap-2">
                {secondaryActions.map((action) => (
                  <QuickActionButton key={action.id} action={action} isCompact />
                ))}
              </div>

              {/* Export Actions - Compact Row */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1 justify-center">
                  {exportActions.map((action) => (
                    <QuickActionButton key={action.id} action={action} isCompact />
                  ))}
                </div>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ============================================================================
// Floating Quick Actions Bar (Mobile-friendly)
// ============================================================================

interface FloatingActionsBarProps {
  actions: QuickAction[];
  className?: string;
}

export function FloatingActionsBar({ actions, className }: FloatingActionsBarProps) {
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-2 p-2 rounded-2xl",
        "bg-white/90 backdrop-blur-xl shadow-2xl border border-slate-200/50",
        className
      )}
    >
      {actions.slice(0, 5).map((action) => (
        <QuickActionButton key={action.id} action={action} isCompact />
      ))}
    </motion.div>
  );
}

// ============================================================================
// AI Insights Card
// ============================================================================

interface AIInsight {
  id: string;
  type: 'risk' | 'opportunity' | 'action' | 'info';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionLabel?: string;
  onAction?: () => void;
}

interface AIInsightsCardProps {
  contractId: string;
  insights?: AIInsight[];
  isLoading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

export function AIInsightsCard({
  contractId,
  insights = [],
  isLoading,
  onRefresh,
  className,
}: AIInsightsCardProps) {
  const typeStyles = {
    risk: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    opportunity: { icon: Sparkles, color: 'text-green-600', bg: 'bg-green-50' },
    action: { icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
    info: { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
  };

  // Default insights for demo
  const defaultInsights: AIInsight[] = [
    {
      id: '1',
      type: 'risk',
      title: 'Contract expires in 30 days',
      description: 'Consider initiating renewal discussions with the counterparty.',
      priority: 'high',
      actionLabel: 'Set Reminder',
    },
    {
      id: '2',
      type: 'opportunity',
      title: 'Early payment discount available',
      description: '2% discount if payment is made within 10 days.',
      priority: 'medium',
    },
    {
      id: '3',
      type: 'action',
      title: 'Missing compliance document',
      description: 'GDPR compliance addendum needs to be attached.',
      priority: 'high',
      actionLabel: 'Upload Document',
    },
  ];

  const displayInsights = insights.length > 0 ? insights : defaultInsights;

  return (
    <Card className={cn("shadow-sm border-slate-200/50 overflow-hidden", className)}>
      <CardHeader className="pb-3 bg-gradient-to-r from-purple-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600">
              <Brain className="w-4 h-4 text-white" />
            </div>
            AI Insights
            <Badge className="bg-purple-100 text-purple-700 text-xs">
              {displayInsights.length}
            </Badge>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-8 w-8 p-0"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
            ) : (
              <Sparkles className="w-4 h-4 text-purple-600" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex items-start gap-3">
                <div className="w-8 h-8 bg-slate-200 rounded-lg" />
                <div className="flex-1">
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-slate-200 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          displayInsights.map((insight) => {
            const style = typeStyles[insight.type];
            const Icon = style.icon;
            return (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl",
                  style.bg
                )}
              >
                <div className={cn("p-1.5 rounded-lg", style.bg)}>
                  <Icon className={cn("w-4 h-4", style.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-slate-900">
                      {insight.title}
                    </span>
                    {insight.priority === 'high' && (
                      <Badge variant="destructive" className="text-xs h-5">
                        High Priority
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    {insight.description}
                  </p>
                  {insight.actionLabel && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={insight.onAction}
                      className={cn("mt-2 h-7 text-xs", style.color)}
                    >
                      {insight.actionLabel}
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export default QuickActionsPanel;
