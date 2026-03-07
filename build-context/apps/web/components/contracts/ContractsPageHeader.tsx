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

// ============================================================================
// TYPES
// ============================================================================

export interface ContractsPageHeaderProps {
  onRefresh: () => void;
  onAdvancedSearch: () => void;
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
  const router = useRouter();
  const [showRefreshSuccess, setShowRefreshSuccess] = useState(false);
  const [showQuickUpload, setShowQuickUpload] = useState(false);
  
  // Listen for keyboard shortcut event
  useEffect(() => {
    const handleOpenQuickUpload = () => setShowQuickUpload(true);
    window.addEventListener('openQuickUpload', handleOpenQuickUpload);
    return () => window.removeEventListener('openQuickUpload', handleOpenQuickUpload);
  }, []);
  
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
    <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-purple-900 to-purple-900">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDJ2LTJoMzR6bTAtNHYySDJ2LTJoMzR6bTAtNHYySDF2LTJoMzV6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
      
      {/* Decorative Blobs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-500/20 rounded-full blur-3xl" />
      
      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageBreadcrumb />
        
        <div className="mt-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          {/* Title & Description */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-white/10 backdrop-blur-sm rounded-xl">
                <FileText className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Contracts</h1>
            </div>
            <p className="text-violet-100/80 max-w-xl">
              Manage your contract portfolio with AI-powered insights and analysis
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
                      <span className="text-violet-400">Updated</span>
                    </motion.div>
                  ) : (
                    <>
                      <RefreshCw className={cn(
                        "h-4 w-4 mr-2 transition-transform",
                        isRefreshing && "animate-spin"
                      )} />
                      {isRefreshing ? "Refreshing..." : "Refresh"}
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="flex items-center gap-2">
                  Refresh list
                  <kbd className="px-1.5 py-0.5 text-xs bg-slate-100 rounded">R</kbd>
                </div>
              </TooltipContent>
            </Tooltip>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={onAdvancedSearch}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Advanced
            </Button>
            
            {showTaxonomyLink && (
              <Button 
                variant="outline" 
                size="sm"
                asChild
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
              >
                <Link href="/settings/taxonomy">
                  <Tag className="h-4 w-4 mr-2" />
                  Taxonomy
                </Link>
              </Button>
            )}
            
            {/* New Contract Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  size="sm" 
                  className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white border-0 shadow-lg shadow-violet-500/25"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Contract
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Create Contract</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={() => setShowQuickUpload(true)}>
                  <FileUp className="h-4 w-4 mr-2 text-violet-500" />
                  <div>
                    <p className="font-medium">Quick Upload</p>
                    <p className="text-xs text-slate-500">Upload files without leaving</p>
                  </div>
                </DropdownMenuItem>
                
                <DropdownMenuItem asChild>
                  <Link href="/upload">
                    <Upload className="h-4 w-4 mr-2 text-violet-500" />
                    <div>
                      <p className="font-medium">Advanced Upload</p>
                      <p className="text-xs text-slate-500">Full upload with AI analysis</p>
                    </div>
                  </Link>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem asChild>
                  <Link href="/contracts/new">
                    <FilePlus className="h-4 w-4 mr-2 text-violet-500" />
                    <div>
                      <p className="font-medium">Create Manually</p>
                      <p className="text-xs text-slate-500">Enter contract details by hand</p>
                    </div>
                  </Link>
                </DropdownMenuItem>
                
                <DropdownMenuItem asChild>
                  <Link href="/contracts/generate">
                    <LayoutTemplate className="h-4 w-4 mr-2 text-violet-500" />
                    <div>
                      <p className="font-medium">Generate from Template</p>
                      <p className="text-xs text-slate-500">Use a contract template</p>
                    </div>
                  </Link>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem asChild>
                  <Link href="/contracts/ai-draft">
                    <Sparkles className="h-4 w-4 mr-2 text-amber-500" />
                    <div>
                      <p className="font-medium">AI Draft Assistant</p>
                      <p className="text-xs text-slate-500">Let AI help you draft</p>
                    </div>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      
      {/* Quick Upload Modal */}
      <QuickUploadModal
        isOpen={showQuickUpload}
        onClose={() => setShowQuickUpload(false)}
        onUploadComplete={handleQuickUploadComplete}
      />
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
