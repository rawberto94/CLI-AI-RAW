/**
 * Contract Bulk Actions Bar
 * 
 * Floating action bar for bulk operations on selected contracts
 */

"use client";

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  X,
  Download,
  Brain,
  FileBarChart,
  Tag,
  Share2,
  Trash2,
  Loader2,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface BulkActionsBarProps {
  selectedCount: number;
  isProcessing: boolean;
  isCategorizing: boolean;
  onClear: () => void;
  onExport: () => void;
  onAnalyze: () => void;
  onAiReport: () => void;
  onCategorize: () => void;
  onShare: () => void;
  onDelete: () => void;
}

// ============================================================================
// BULK ACTIONS BAR
// ============================================================================

export const BulkActionsBar = memo(function BulkActionsBar({
  selectedCount,
  isProcessing,
  isCategorizing,
  onClear,
  onExport,
  onAnalyze,
  onAiReport,
  onCategorize,
  onShare,
  onDelete,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.2, type: "spring", stiffness: 300 }}
      >
        <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 border-0 shadow-xl shadow-blue-500/25">
          <CardContent className="py-4 px-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              {/* Selection Info */}
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm">
                  <span className="text-lg font-bold text-white">{selectedCount}</span>
                </div>
                <div>
                  <span className="font-semibold text-white">
                    {selectedCount} contract{selectedCount !== 1 ? 's' : ''} selected
                  </span>
                  <p className="text-blue-100 text-xs">Ready for bulk actions</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/80 hover:text-white hover:bg-white/10"
                  onClick={onClear}
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-white/90 hover:bg-white text-slate-800 shadow-sm"
                      onClick={onExport}
                      disabled={isProcessing}
                    >
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      <span className="hidden sm:inline ml-2">Export</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Export selected contracts</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-white/90 hover:bg-white text-slate-800 shadow-sm"
                      onClick={onAnalyze}
                      disabled={isProcessing}
                    >
                      <Brain className="h-4 w-4" />
                      <span className="hidden sm:inline ml-2">AI Analyze</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Run AI analysis on selected</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 shadow-lg shadow-purple-500/25"
                      onClick={onAiReport}
                      disabled={isProcessing}
                    >
                      <FileBarChart className="h-4 w-4" />
                      <span className="hidden sm:inline ml-2">AI Report</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Generate comprehensive AI report for selected contracts</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white border-0 shadow-lg shadow-indigo-500/25"
                      onClick={onCategorize}
                      disabled={isProcessing || isCategorizing}
                    >
                      {isCategorizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
                      <span className="hidden sm:inline ml-2">Categorize</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Auto-categorize selected contracts with AI</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-white/90 hover:bg-white text-slate-800 shadow-sm"
                      onClick={onShare}
                      disabled={isProcessing}
                    >
                      <Share2 className="h-4 w-4" />
                      <span className="hidden sm:inline ml-2">Share</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Share selected contracts</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      className="bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25"
                      onClick={onDelete}
                      disabled={isProcessing}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="hidden sm:inline ml-2">Delete</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete selected contracts</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
});

// ============================================================================
// COMPACT BULK ACTIONS (for smaller screens)
// ============================================================================

interface CompactBulkActionsProps {
  selectedCount: number;
  onClear: () => void;
  onOpenMenu: () => void;
}

export const CompactBulkActions = memo(function CompactBulkActions({
  selectedCount,
  onClear,
  onOpenMenu,
}: CompactBulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
    >
      <Card className="bg-blue-600 border-0 shadow-xl">
        <CardContent className="py-2 px-4 flex items-center gap-3">
          <span className="text-white text-sm font-medium">
            {selectedCount} selected
          </span>
          <Button
            size="sm"
            className="bg-white text-blue-600 hover:bg-blue-50"
            onClick={onOpenMenu}
          >
            Actions
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-blue-700"
            onClick={onClear}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
});
