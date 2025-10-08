"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trash2,
  Download,
  Tag,
  Archive,
  CheckCircle,
  X,
  GitCompare,
} from "lucide-react";
import {
  executeBulkAction,
  type BulkAction,
} from "@/lib/contracts/bulk-actions";
import { TagSelector } from "./TagSelector";

interface BulkActionsToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onActionComplete: () => void;
  selectedIds: string[];
  onCompare?: () => void;
}

export function BulkActionsToolbar({
  selectedCount,
  onClearSelection,
  onActionComplete,
  selectedIds,
  onCompare,
}: BulkActionsToolbarProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTagSelector, setShowTagSelector] = useState(false);

  const handleAction = async (action: BulkAction, options?: any) => {
    setIsProcessing(true);
    try {
      const result = await executeBulkAction(action, selectedIds, options);

      if (result.success) {
        alert(`Successfully ${action}ed ${result.processed} contract(s)`);
        onActionComplete();
        onClearSelection();
      } else {
        alert(`Failed: ${result.errors?.join(", ")}`);
      }
    } catch (error) {
      alert(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTagAction = async (tagIds: string[]) => {
    await handleAction("tag", { tagIds });
    setShowTagSelector(false);
  };

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-white border border-gray-200 rounded-xl shadow-2xl p-4 flex items-center gap-4 min-w-[600px]">
        {/* Selection Count */}
        <div className="flex items-center gap-2">
          <Badge className="bg-blue-600 text-white text-base px-3 py-1">
            {selectedCount} selected
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            disabled={isProcessing}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-gray-200" />

        {/* Actions */}
        <div className="flex items-center gap-2 flex-1">
          {/* Step 3: Compare Button */}
          {onCompare && selectedCount >= 2 && selectedCount <= 4 && (
            <Button
              variant="default"
              size="sm"
              onClick={onCompare}
              disabled={isProcessing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <GitCompare className="w-4 h-4 mr-2" />
              Compare
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTagSelector(true)}
            disabled={isProcessing}
          >
            <Tag className="w-4 h-4 mr-2" />
            Add Tags
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction("export")}
            disabled={isProcessing}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction("archive")}
            disabled={isProcessing}
          >
            <Archive className="w-4 h-4 mr-2" />
            Archive
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction("mark-reviewed")}
            disabled={isProcessing}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Mark Reviewed
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm(`Delete ${selectedCount} contract(s)?`)) {
                handleAction("delete");
              }
            }}
            disabled={isProcessing}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
            Processing...
          </div>
        )}
      </div>

      {/* Tag Selector Modal */}
      {showTagSelector && (
        <TagSelector
          onSelect={handleTagAction}
          onClose={() => setShowTagSelector(false)}
        />
      )}
    </div>
  );
}
