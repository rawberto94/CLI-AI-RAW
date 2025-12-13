"use client";

import React, { memo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CheckSquare,
  Square,
  Trash2,
  Download,
  Tag,
  FolderInput,
  Share2,
  Sparkles,
  Archive,
  RefreshCw,
  MoreHorizontal,
  AlertTriangle,
  FileText,
  Clock,
  ChevronDown,
  Copy,
  ExternalLink,
  Printer,
  Mail,
  Lock,
  Unlock,
  Pin,
  Heart,
  Users,
  Brain,
  FileBarChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export type BulkAction =
  | "delete"
  | "export"
  | "tag"
  | "move"
  | "share"
  | "analyze"
  | "archive"
  | "status"
  | "duplicate"
  | "print"
  | "email"
  | "lock"
  | "unlock"
  | "pin"
  | "unpin"
  | "favorite"
  | "unfavorite"
  | "assign"
  | "ai_report"
  | "categorize";

export interface BulkActionResult {
  success: number;
  failed: number;
  errors?: Array<{ id: string; error: string }>;
}

export interface EnhancedBulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  selectedIds: string[];
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onAction: (action: BulkAction, params?: Record<string, any>) => Promise<BulkActionResult | void>;
  availableTags?: string[];
  availableFolders?: Array<{ id: string; name: string }>;
  availableStatuses?: Array<{ value: string; label: string }>;
  availableUsers?: Array<{ id: string; name: string; email: string }>;
  isLoading?: boolean;
  className?: string;
}

// ============================================================================
// Sub-Components: Dialogs
// ============================================================================

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: "default" | "destructive";
  onConfirm: () => void;
  isLoading?: boolean;
}

const ConfirmDialog = memo(function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmVariant = "default",
  onConfirm,
  isLoading,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

interface TagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableTags: string[];
  onApply: (tags: string[], mode: "add" | "remove" | "replace") => void;
  isLoading?: boolean;
}

const TagDialog = memo(function TagDialog({
  open,
  onOpenChange,
  availableTags,
  onApply,
  isLoading,
}: TagDialogProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [mode, setMode] = useState<"add" | "remove" | "replace">("add");

  const handleAddNewTag = () => {
    if (newTag && !selectedTags.includes(newTag)) {
      setSelectedTags([...selectedTags, newTag]);
      setNewTag("");
    }
  };

  const handleApply = () => {
    onApply(selectedTags, mode);
    setSelectedTags([]);
    setNewTag("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
          <DialogDescription>Add, remove, or replace tags on selected contracts.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Mode Selection */}
          <div className="space-y-2">
            <Label>Action</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add">Add tags to existing</SelectItem>
                <SelectItem value="remove">Remove these tags</SelectItem>
                <SelectItem value="replace">Replace all tags</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Available Tags */}
          <div className="space-y-2">
            <Label>Select Tags</Label>
            <div className="flex flex-wrap gap-2 p-3 border rounded-lg max-h-[150px] overflow-y-auto">
              {availableTags.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() =>
                    setSelectedTags((prev) =>
                      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                    )
                  }
                >
                  {tag}
                </Badge>
              ))}
              {availableTags.length === 0 && (
                <p className="text-sm text-muted-foreground">No tags available</p>
              )}
            </div>
          </div>

          {/* Add New Tag */}
          <div className="flex gap-2">
            <Input
              placeholder="Add new tag..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddNewTag()}
            />
            <Button variant="outline" onClick={handleAddNewTag} disabled={!newTag}>
              Add
            </Button>
          </div>

          {/* Selected Tags Preview */}
          {selectedTags.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Tags ({selectedTags.length})</Label>
              <div className="flex flex-wrap gap-1">
                {selectedTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={() => setSelectedTags((prev) => prev.filter((t) => t !== tag))}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={selectedTags.length === 0 || isLoading}>
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : (
              `Apply to Selected`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onExport: (format: string, options: Record<string, boolean>) => void;
  isLoading?: boolean;
}

const ExportDialog = memo(function ExportDialog({
  open,
  onOpenChange,
  count,
  onExport,
  isLoading,
}: ExportDialogProps) {
  const [format, setFormat] = useState("pdf");
  const [options, setOptions] = useState({
    includeAttachments: true,
    includeMetadata: true,
    includeHistory: false,
    includeAnalysis: true,
  });

  const handleExport = () => {
    onExport(format, options);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Export {count} Contracts</DialogTitle>
          <DialogDescription>Choose export format and options.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label>Format</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF Document</SelectItem>
                <SelectItem value="docx">Word Document (.docx)</SelectItem>
                <SelectItem value="xlsx">Excel Spreadsheet (.xlsx)</SelectItem>
                <SelectItem value="csv">CSV File</SelectItem>
                <SelectItem value="json">JSON Data</SelectItem>
                <SelectItem value="zip">ZIP Archive (all files)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <Label>Include</Label>
            {Object.entries({
              includeAttachments: "Attachments",
              includeMetadata: "Metadata & Details",
              includeHistory: "Activity History",
              includeAnalysis: "AI Analysis Results",
            }).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox
                  id={key}
                  checked={options[key as keyof typeof options]}
                  onCheckedChange={(checked) =>
                    setOptions((prev) => ({ ...prev, [key]: !!checked }))
                  }
                />
                <Label htmlFor={key} className="text-sm font-normal cursor-pointer">
                  {label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isLoading}>
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const EnhancedBulkActionsBar = memo(function EnhancedBulkActionsBar({
  selectedCount,
  totalCount,
  selectedIds,
  onSelectAll,
  onDeselectAll,
  onAction,
  availableTags = [],
  availableFolders = [],
  availableStatuses = [],
  availableUsers = [],
  isLoading = false,
  className,
}: EnhancedBulkActionsBarProps) {
  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  // Processing state
  const [processing, setProcessing] = useState<BulkAction | null>(null);

  const handleAction = useCallback(
    async (action: BulkAction, params?: Record<string, any>) => {
      setProcessing(action);
      try {
        await onAction(action, params);
      } finally {
        setProcessing(null);
      }
    },
    [onAction]
  );

  const handleDelete = useCallback(async () => {
    await handleAction("delete");
    setDeleteDialogOpen(false);
  }, [handleAction]);

  const handleArchive = useCallback(async () => {
    await handleAction("archive");
    setArchiveDialogOpen(false);
  }, [handleAction]);

  const handleTagApply = useCallback(
    async (tags: string[], mode: "add" | "remove" | "replace") => {
      await handleAction("tag", { tags, mode });
    },
    [handleAction]
  );

  const handleExport = useCallback(
    async (format: string, options: Record<string, boolean>) => {
      await handleAction("export", { format, options });
    },
    [handleAction]
  );

  if (selectedCount === 0) return null;

  const allSelected = selectedCount === totalCount;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className={cn(
            "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
            "bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white",
            "rounded-2xl shadow-2xl shadow-black/30",
            "flex items-center gap-1 sm:gap-3 px-3 sm:px-5 py-3",
            "border border-gray-700/50",
            "backdrop-blur-lg",
            className
          )}
        >
          {/* Selection Count */}
          <div className="flex items-center gap-2 pr-2 sm:pr-4 border-r border-gray-700">
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30"
            >
              <span className="text-sm sm:text-lg font-bold">{selectedCount}</span>
            </motion.div>
            <span className="text-xs sm:text-sm text-gray-300 hidden sm:block">selected</span>
          </div>

          {/* Select All / Deselect */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-300 hover:text-white hover:bg-white/10 h-8 px-2 sm:px-3"
                  onClick={allSelected ? onDeselectAll : onSelectAll}
                >
                  {allSelected ? (
                    <>
                      <Square className="w-4 h-4 sm:mr-1.5" />
                      <span className="hidden sm:inline">Deselect</span>
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-4 h-4 sm:mr-1.5" />
                      <span className="hidden sm:inline">All ({totalCount})</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {allSelected ? "Clear selection" : `Select all ${totalCount} contracts`}
              </TooltipContent>
            </Tooltip>

            {/* Divider */}
            <div className="w-px h-6 bg-gray-700" />

            {/* Quick Actions */}
            <div className="flex items-center gap-0.5 sm:gap-1">
              {/* AI Analyze */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-purple-400 hover:text-purple-300 hover:bg-purple-900/30 h-8 w-8 p-0 sm:w-auto sm:px-3"
                    onClick={() => handleAction("analyze")}
                    disabled={processing !== null}
                  >
                    {processing === "analyze" ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Brain className="w-4 h-4" />
                    )}
                    <span className="hidden lg:inline ml-2">AI Analyze</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>AI Analyze Selected</TooltipContent>
              </Tooltip>

              {/* AI Report */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 h-8 px-2 sm:px-3"
                    onClick={() => handleAction("ai_report")}
                    disabled={processing !== null}
                  >
                    {processing === "ai_report" ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileBarChart className="w-4 h-4" />
                    )}
                    <span className="hidden lg:inline ml-2">AI Report</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Generate AI Report</TooltipContent>
              </Tooltip>

              {/* Export */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-300 hover:text-white hover:bg-white/10 h-8 w-8 p-0 sm:w-auto sm:px-3"
                    onClick={() => setExportDialogOpen(true)}
                    disabled={processing !== null}
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden lg:inline ml-2">Export</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export</TooltipContent>
              </Tooltip>

              {/* Tags */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-300 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
                    onClick={() => setTagDialogOpen(true)}
                    disabled={processing !== null}
                  >
                    <Tag className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Manage Tags</TooltipContent>
              </Tooltip>

              {/* Share */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-300 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
                    onClick={() => handleAction("share")}
                    disabled={processing !== null}
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Share</TooltipContent>
              </Tooltip>

              {/* Archive */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-300 hover:text-white hover:bg-white/10 h-8 w-8 p-0 hidden sm:inline-flex"
                    onClick={() => setArchiveDialogOpen(true)}
                    disabled={processing !== null}
                  >
                    <Archive className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Archive</TooltipContent>
              </Tooltip>

              {/* More Actions Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-300 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
                    disabled={processing !== null}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-48">
                  <DropdownMenuItem onClick={() => handleAction("categorize")}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Auto-Categorize
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAction("duplicate")}>
                    <Copy className="w-4 h-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleAction("pin")}>
                    <Pin className="w-4 h-4 mr-2" />
                    Pin All
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAction("favorite")}>
                    <Heart className="w-4 h-4 mr-2" />
                    Favorite All
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleAction("lock")}>
                    <Lock className="w-4 h-4 mr-2" />
                    Lock
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Divider */}
              <div className="w-px h-6 bg-gray-700 mx-1" />

              {/* Delete */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/30 h-8 w-8 p-0 sm:w-auto sm:px-3"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={processing !== null}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline ml-2">Delete</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete Selected</TooltipContent>
              </Tooltip>
            </div>

            {/* Close Button */}
            <div className="w-px h-6 bg-gray-700 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
                  onClick={onDeselectAll}
                >
                  <X className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear Selection</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </motion.div>
      </AnimatePresence>

      {/* Dialogs */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Contracts"
        description={`Are you sure you want to delete ${selectedCount} contract${selectedCount > 1 ? "s" : ""}? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={handleDelete}
        isLoading={processing === "delete"}
      />

      <ConfirmDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        title="Archive Contracts"
        description={`Are you sure you want to archive ${selectedCount} contract${selectedCount > 1 ? "s" : ""}? Archived contracts can be restored later.`}
        confirmLabel="Archive"
        onConfirm={handleArchive}
        isLoading={processing === "archive"}
      />

      <TagDialog
        open={tagDialogOpen}
        onOpenChange={setTagDialogOpen}
        availableTags={availableTags}
        onApply={handleTagApply}
        isLoading={processing === "tag"}
      />

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        count={selectedCount}
        onExport={handleExport}
        isLoading={processing === "export"}
      />
    </>
  );
});

export default EnhancedBulkActionsBar;
