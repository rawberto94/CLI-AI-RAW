'use client';

import React, { memo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pencil,
  Download,
  Share2,
  Sparkles,
  FileType,
  GitCompare,
  Copy,
  Check,
  MoreHorizontal,
  X,
  Bell,
  History,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'danger';
  shortcut?: string;
  disabled?: boolean;
}

interface QuickActionBarProps {
  onEdit: () => void;
  onDownload: () => void;
  onShare: () => void;
  onAIAnalyze: () => void;
  onViewPDF: () => void;
  onCompare: () => void;
  onCopyId: () => void;
  onSetReminder?: () => void;
  onViewHistory?: () => void;
  isEditing?: boolean;
  isPDFVisible?: boolean;
  contractId: string;
  className?: string;
}

export const QuickActionBar = memo(function QuickActionBar({
  onEdit,
  onDownload,
  onShare,
  onAIAnalyze,
  onViewPDF,
  onCompare,
  onCopyId,
  onSetReminder,
  onViewHistory,
  isEditing = false,
  isPDFVisible = false,
  contractId,
  className = '',
}: QuickActionBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Handle scroll to show/hide bar
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Show bar when scrolling up or at top
      if (currentScrollY < lastScrollY || currentScrollY < 100) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 200) {
        // Hide when scrolling down after 200px
        setIsVisible(false);
        setIsExpanded(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const handleCopy = () => {
    onCopyId();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const primaryActions: QuickAction[] = [
    {
      id: 'ai-analyze',
      label: 'AI Analyze',
      icon: Sparkles,
      onClick: onAIAnalyze,
      variant: 'primary',
      shortcut: '⌘A',
    },
    {
      id: 'edit',
      label: isEditing ? 'Editing...' : 'Edit',
      icon: Pencil,
      onClick: onEdit,
      shortcut: 'E',
      disabled: isEditing,
    },
    {
      id: 'download',
      label: 'Download',
      icon: Download,
      onClick: onDownload,
      shortcut: '⌘D',
    },
    {
      id: 'share',
      label: 'Share',
      icon: Share2,
      onClick: onShare,
    },
  ];

  const secondaryActions: QuickAction[] = [
    {
      id: 'view-pdf',
      label: isPDFVisible ? 'Hide PDF' : 'View PDF',
      icon: FileType,
      onClick: onViewPDF,
      shortcut: 'P',
    },
    {
      id: 'compare',
      label: 'Compare',
      icon: GitCompare,
      onClick: onCompare,
    },
    {
      id: 'copy-id',
      label: copied ? 'Copied!' : 'Copy ID',
      icon: copied ? Check : Copy,
      onClick: handleCopy,
    },
    ...(onSetReminder ? [{
      id: 'reminder',
      label: 'Set Reminder',
      icon: Bell,
      onClick: onSetReminder,
    }] : []),
    ...(onViewHistory ? [{
      id: 'history',
      label: 'View History',
      icon: History,
      onClick: onViewHistory,
    }] : []),
  ];

  const getButtonClasses = (variant?: 'default' | 'primary' | 'danger') => {
    switch (variant) {
      case 'primary':
        return 'bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/25';
      case 'danger':
        return 'bg-red-500 text-white hover:bg-red-600';
      default:
        return 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <TooltipProvider>
      <AnimatePresence>
        {isVisible && (
          <motion.div key="visible"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
              className
            )}
          >
            <div className="relative">
              {/* Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl blur-xl" />
              
              {/* Main Bar */}
              <motion.div
                layout
                className="relative flex items-center gap-1.5 p-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-2xl"
              >
                {/* Primary Actions */}
                {primaryActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Tooltip key={action.id}>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          onClick={action.onClick}
                          disabled={action.disabled}
                          className={cn(
                            "h-10 px-4 rounded-xl font-medium transition-all duration-200",
                            getButtonClasses(action.variant),
                            action.disabled && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <Icon className="h-4 w-4 mr-2" />
                          <span className="hidden sm:inline">{action.label}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-slate-900 text-white border-slate-700">
                        <div className="flex items-center gap-2">
                          <span>{action.label}</span>
                          {action.shortcut && (
                            <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-800 rounded">
                              {action.shortcut}
                            </kbd>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}

                {/* Divider */}
                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

                {/* More Actions Toggle */}
                <AnimatePresence mode="popLayout">
                  {isExpanded && (
                    <motion.div key="expanded"
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="flex items-center gap-1.5 overflow-hidden"
                    >
                      {secondaryActions.map((action) => {
                        const Icon = action.icon;
                        return (
                          <Tooltip key={action.id}>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={action.onClick}
                                className="h-10 w-10 p-0 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <Icon className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-slate-900 text-white border-slate-700">
                              <div className="flex items-center gap-2">
                                <span>{action.label}</span>
                                {action.shortcut && (
                                  <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-800 rounded">
                                    {action.shortcut}
                                  </kbd>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Expand/Collapse Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="h-10 w-10 p-0 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <motion.div
                        animate={{ rotate: isExpanded ? 45 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {isExpanded ? (
                          <X className="h-4 w-4" />
                        ) : (
                          <MoreHorizontal className="h-4 w-4" />
                        )}
                      </motion.div>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-slate-900 text-white border-slate-700">
                    {isExpanded ? 'Less actions' : 'More actions'}
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </TooltipProvider>
  );
});

export default QuickActionBar;
