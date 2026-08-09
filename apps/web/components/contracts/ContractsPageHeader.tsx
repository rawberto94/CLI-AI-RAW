/**
 * Contract Page Header
 * 
 * Hero header section for the contracts list page
 * v2.2 - Enhanced with creation dropdown menu and quick upload modal
 */

"use client";

import React, { memo, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageBreadcrumb } from '@/components/navigation';
import { useTranslations } from 'next-intl';
import {
  FileText,
  RefreshCw,
  SlidersHorizontal,
  Tag,
  Upload,
  CheckCircle,
  Plus,
  ChevronDown,
  FilePlus,
  FileUp,
  Sparkles,
  LayoutTemplate,
  PenLine,
} from "lucide-react";
import { QuickUploadModal } from "./QuickUploadModal";
import { cn } from "@/lib/utils";
import { useDemoMode } from "@/hooks/useDemoMode";
import { usePermissions } from "@/hooks/usePermissions";

// ============================================================================
// TYPES
// ============================================================================

export interface ContractsPageHeaderProps {
  onRefresh: () => void;
  onAdvancedSearch?: () => void;
  showTaxonomyLink?: boolean;
  extraActions?: React.ReactNode;
  isRefreshing?: boolean;
  onQuickUploadComplete?: (contractIds: string[]) => void;
}

// ============================================================================
// HEADER COMPONENT
// ============================================================================

export const ContractsPageHeader = memo(function ContractsPageHeader({
  onRefresh,
  onAdvancedSearch,
  showTaxonomyLink = true,
  extraActions,
  isRefreshing = false,
  onQuickUploadComplete,
}: ContractsPageHeaderProps) {
  const isDemo = useDemoMode();
  const { canCreateContracts } = usePermissions();
  const router = useRouter();
  const t = useTranslations('contracts');
  const tCommon = useTranslations('common');
  const [showRefreshSuccess, setShowRefreshSuccess] = useState(false);
  const [showQuickUpload, setShowQuickUpload] = useState(false);
  
  // Listen for keyboard shortcut event (only if user may create/upload)
  useEffect(() => {
    if (!canCreateContracts) return;
    const handleOpenQuickUpload = () => setShowQuickUpload(true);
    window.addEventListener('openQuickUpload', handleOpenQuickUpload);
    return () => window.removeEventListener('openQuickUpload', handleOpenQuickUpload);
  }, [canCreateContracts]);
  
  const handleRefresh = useCallback(() => {
    onRefresh();
    // Show success indicator after a brief delay
    setTimeout(() => {
      setShowRefreshSuccess(true);
      setTimeout(() => setShowRefreshSuccess(false), 1500);
    }, 500);
  }, [onRefresh]);

  const handleQuickUploadComplete = useCallback((contractIds: string[]) => {
    onQuickUploadComplete?.(contractIds);
    onRefresh();
  }, [onQuickUploadComplete, onRefresh]);

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDJ2LTJoMzR6bTAtNHYySDJ2LTJoMzR6bTAtNHYySDF2LTJoMzV6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
      
      {/* Decorative Blobs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-slate-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-slate-400/10 rounded-full blur-3xl" />
      
      {/* Content */}
      <div className="relative max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageBreadcrumb />
        
        <div className="mt-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          {/* Title & Description */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-white/10 backdrop-blur-sm rounded-xl">
                <FileText className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">{t('title')}</h1>
            </div>
            <p className="text-slate-300 max-w-xl">
              {t('hero.subtitle')}
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            {extraActions}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className={cn(
                    "bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm transition-all",
                    showRefreshSuccess && "bg-violet-500/20 border-violet-400/40"
                  )}
                >
                  {showRefreshSuccess ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex items-center"
                    >
                      <CheckCircle className="h-4 w-4 mr-2 text-violet-400" />
                      <span className="text-violet-400">{t('hero.updated')}</span>
                    </motion.div>
                  ) : (
                    <>
                      <RefreshCw className={cn(
                        "h-4 w-4 mr-2 transition-transform",
                        isRefreshing && "animate-spin"
                      )} />
                      {isRefreshing ? t('hero.refreshing') : tCommon('refresh')}
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="flex items-center gap-2">
                  {t('hero.refreshList')}
                  <kbd className="px-1.5 py-0.5 text-xs bg-slate-100 rounded">R</kbd>
                </div>
              </TooltipContent>
            </Tooltip>
            
            {onAdvancedSearch && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={onAdvancedSearch}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              {t('hero.advanced')}
            </Button>
            )}
            
            {showTaxonomyLink && !isDemo && (
              <Button 
                variant="outline" 
                size="sm"
                asChild
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
              >
                <Link href="/settings/taxonomy">
                  <Tag className="h-4 w-4 mr-2" />
                  {t('hero.taxonomy')}
                </Link>
              </Button>
            )}

            {/* New Contract Dropdown — create/upload requires contracts:create */}
            {canCreateContracts && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white border-0 shadow-lg shadow-violet-500/25"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('hero.newContract')}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t('hero.createContract')}</DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => setShowQuickUpload(true)}>
                  <FileUp className="h-4 w-4 mr-2 text-blue-500" />
                  <div>
                    <p className="font-medium">{t('hero.quickUpload')}</p>
                    <p className="text-xs text-slate-500">{t('hero.quickUploadDesc')}</p>
                  </div>
                </DropdownMenuItem>

                {!isDemo && (
                  <DropdownMenuItem asChild>
                    <Link href="/upload">
                      <Upload className="h-4 w-4 mr-2 text-indigo-500" />
                      <div>
                        <p className="font-medium">{t('hero.advancedUpload')}</p>
                        <p className="text-xs text-slate-500">{t('hero.advancedUploadDesc')}</p>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                )}

                {!isDemo && <DropdownMenuSeparator />}

                {!isDemo && (
                  <DropdownMenuItem asChild>
                    <Link href="/contracts/new">
                      <FilePlus className="h-4 w-4 mr-2 text-slate-500" />
                      <div>
                        <p className="font-medium">{t('hero.createManually')}</p>
                        <p className="text-xs text-slate-500">{t('hero.createManuallyDesc')}</p>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                )}

                {!isDemo && (
                  <DropdownMenuItem asChild>
                    <Link href="/contracts/generate">
                      <LayoutTemplate className="h-4 w-4 mr-2 text-teal-500" />
                      <div>
                        <p className="font-medium">{t('hero.generateFromTemplate')}</p>
                        <p className="text-xs text-slate-500">{t('hero.generateFromTemplateDesc')}</p>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                )}

                {!isDemo && <DropdownMenuSeparator />}

                {!isDemo && (
                  <DropdownMenuItem asChild>
                    <Link href="/contracts/ai-draft">
                      <Sparkles className="h-4 w-4 mr-2 text-amber-500" />
                      <div>
                        <p className="font-medium">{t('hero.aiDraftAssistant')}</p>
                        <p className="text-xs text-slate-500">{t('hero.aiDraftAssistantDesc')}</p>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            )}
          </div>
        </div>
      </div>
      
      {/* Quick Upload Modal */}
      {canCreateContracts && (
      <QuickUploadModal
        isOpen={showQuickUpload}
        onClose={() => setShowQuickUpload(false)}
        onUploadComplete={handleQuickUploadComplete}
      />
      )}
    </div>
  );
});

// ============================================================================
// COMPACT HEADER (for smaller sections)
// ============================================================================

interface CompactHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

export const CompactHeader = memo(function CompactHeader({
  title,
  subtitle,
  icon,
  actions,
}: CompactHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25">
            {icon}
          </div>
        )}
        <div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          {subtitle && (
            <p className="text-sm text-slate-500">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
});
