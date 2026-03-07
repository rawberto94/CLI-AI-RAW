/**
 * Smart Re-Extraction Component
 * 
 * Helps users improve low-confidence metadata extractions by:
 * - Highlighting uncertain fields
 * - Showing extraction context
 * - Allowing guided re-extraction
 * - Learning from corrections
 */

"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Wand2,
  Eye,
  Edit3,
  Save,
  X,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface ExtractedField {
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  value: any;
  confidence: number | null;
  source?: string;
  alternatives?: Array<{ value: any; confidence: number }>;
}

interface SmartReExtractionProps {
  contractId: string;
  tenantId?: string;
  fields: ExtractedField[];
  contractText?: string;
  onFieldUpdate?: (fieldKey: string, value: any, action: "approved" | "corrected" | "rejected") => void;
  onReExtract?: (fieldKeys: string[]) => Promise<ExtractedField[]>;
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SmartReExtraction({
  contractId,
  tenantId = "demo",
  fields,
  contractText,
  onFieldUpdate,
  onReExtract,
  className = "",
}: SmartReExtractionProps) {
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [isReExtracting, setIsReExtracting] = useState(false);
  const [contextDialogField, setContextDialogField] = useState<ExtractedField | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Set<string>>(new Set());

  // Categorize fields by confidence
  const lowConfidence = fields.filter(f => f.confidence !== null && f.confidence < 0.6);
  const mediumConfidence = fields.filter(f => f.confidence !== null && f.confidence >= 0.6 && f.confidence < 0.85);
  const highConfidence = fields.filter(f => f.confidence !== null && f.confidence >= 0.85);
  const noValue = fields.filter(f => f.value === null);

  // Handle field selection for bulk re-extraction
  const toggleFieldSelection = (fieldKey: string) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(fieldKey)) {
      newSelected.delete(fieldKey);
    } else {
      newSelected.add(fieldKey);
    }
    setSelectedFields(newSelected);
  };

  // Handle bulk re-extraction
  const handleReExtract = useCallback(async () => {
    if (selectedFields.size === 0 || !onReExtract) return;

    setIsReExtracting(true);
    try {
      await onReExtract(Array.from(selectedFields));
      setSelectedFields(new Set());
    } catch {
      // Re-extraction failed
    } finally {
      setIsReExtracting(false);
    }
  }, [selectedFields, onReExtract]);

  // Handle field edit
  const startEditing = (field: ExtractedField) => {
    setEditingField(field.fieldKey);
    setEditValue(typeof field.value === "object" ? JSON.stringify(field.value) : String(field.value ?? ""));
  };

  const saveEdit = (field: ExtractedField) => {
    if (!onFieldUpdate) return;

    let parsedValue: any = editValue;
    try {
      parsedValue = JSON.parse(editValue);
    } catch {
      // Keep as string
    }

    onFieldUpdate(field.fieldKey, parsedValue, "corrected");
    setEditingField(null);
    setFeedbackGiven(prev => new Set(prev).add(field.fieldKey));
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  // Handle approval/rejection
  const handleApprove = (field: ExtractedField) => {
    onFieldUpdate?.(field.fieldKey, field.value, "approved");
    setFeedbackGiven(prev => new Set(prev).add(field.fieldKey));
  };

  const handleReject = (field: ExtractedField) => {
    onFieldUpdate?.(field.fieldKey, null, "rejected");
    setFeedbackGiven(prev => new Set(prev).add(field.fieldKey));
  };

  // Find context in contract text
  const findContext = (field: ExtractedField): string => {
    if (!contractText || !field.source) return "";
    
    const searchTerms = [
      field.fieldLabel.toLowerCase(),
      String(field.value).toLowerCase(),
    ];

    for (const term of searchTerms) {
      const index = contractText.toLowerCase().indexOf(term);
      if (index !== -1) {
        const start = Math.max(0, index - 100);
        const end = Math.min(contractText.length, index + term.length + 100);
        return "..." + contractText.substring(start, end) + "...";
      }
    }

    return field.source || "Context not available";
  };

  const getConfidenceColor = (confidence: number | null) => {
    if (confidence === null) return "bg-gray-200";
    if (confidence >= 0.85) return "bg-green-500";
    if (confidence >= 0.6) return "bg-yellow-500";
    return "bg-red-500";
  };

  const renderField = (field: ExtractedField, showSelection: boolean = false) => {
    const isEditing = editingField === field.fieldKey;
    const hasFeedback = feedbackGiven.has(field.fieldKey);
    const isSelected = selectedFields.has(field.fieldKey);

    return (
      <div
        key={field.fieldKey}
        className={`border rounded-lg p-4 transition-all ${
          isSelected ? "border-violet-500 bg-violet-50" : "border-gray-200"
        } ${hasFeedback ? "opacity-60" : ""}`}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {showSelection && onReExtract && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleFieldSelection(field.fieldKey)}
                className="h-4 w-4 rounded border-gray-300"
              />
            )}
            <span className="font-medium">{field.fieldLabel}</span>
            <Badge variant="outline" className="text-xs">
              {field.fieldType}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            {field.confidence !== null && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="flex items-center gap-1">
                      <div
                        className={`w-2 h-2 rounded-full ${getConfidenceColor(field.confidence)}`}
                      />
                      <span className="text-xs text-muted-foreground">
                        {Math.round(field.confidence * 100)}%
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    Confidence: {Math.round(field.confidence * 100)}%
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* Value display/edit */}
        <div className="mb-3">
          {isEditing ? (
            <div className="flex gap-2">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1"
                autoFocus
              />
              <Button size="sm" onClick={() => saveEdit(field)}>
                <Save className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelEdit}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="bg-muted rounded p-2 text-sm font-mono">
              {field.value === null ? (
                <span className="text-muted-foreground italic">Not extracted</span>
              ) : typeof field.value === "object" ? (
                JSON.stringify(field.value, null, 2)
              ) : (
                String(field.value)
              )}
            </div>
          )}
        </div>

        {/* Alternatives */}
        {field.alternatives && field.alternatives.length > 0 && (
          <div className="mb-3">
            <Label className="text-xs text-muted-foreground">Alternative values:</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {field.alternatives.map((alt, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setEditValue(typeof alt.value === "object" ? JSON.stringify(alt.value) : String(alt.value));
                    startEditing(field);
                  }}
                >
                  {typeof alt.value === "object" ? JSON.stringify(alt.value) : String(alt.value)}
                  <span className="ml-1 text-muted-foreground">({Math.round(alt.confidence * 100)}%)</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {!hasFeedback && (
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-600"
                    onClick={() => handleApprove(field)}
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Approve this value</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startEditing(field)}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit this value</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600"
                    onClick={() => handleReject(field)}
                  >
                    <ThumbsDown className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reject this extraction</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Dialog>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setContextDialogField(field)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Context
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Extraction Context</DialogTitle>
                  <DialogDescription>
                    Where this value was found in the contract
                  </DialogDescription>
                </DialogHeader>
                <div className="bg-muted rounded p-4 text-sm max-h-60 overflow-y-auto">
                  <pre className="whitespace-pre-wrap">{findContext(field)}</pre>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {hasFeedback && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Feedback recorded</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Review Extracted Metadata</h3>
          <p className="text-sm text-muted-foreground">
            Review and correct AI-extracted values to improve accuracy
          </p>
        </div>
        {onReExtract && selectedFields.size > 0 && (
          <Button
            onClick={handleReExtract}
            disabled={isReExtracting}
          >
            {isReExtracting ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4 mr-2" />
            )}
            Re-extract {selectedFields.size} field{selectedFields.size > 1 ? "s" : ""}
          </Button>
        )}
      </div>

      {/* Low Confidence Fields */}
      {lowConfidence.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Low Confidence ({lowConfidence.length})
            </CardTitle>
            <CardDescription>
              These fields need your attention - AI was uncertain about the extraction
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lowConfidence.map(field => renderField(field, true))}
          </CardContent>
        </Card>
      )}

      {/* Medium Confidence Fields */}
      {mediumConfidence.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-yellow-600">
              <HelpCircle className="h-5 w-5" />
              Review Recommended ({mediumConfidence.length})
            </CardTitle>
            <CardDescription>
              These fields have moderate confidence - a quick review is recommended
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mediumConfidence.map(field => renderField(field, true))}
          </CardContent>
        </Card>
      )}

      {/* High Confidence Fields */}
      {highConfidence.length > 0 && (
        <Card className="border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              High Confidence ({highConfidence.length})
            </CardTitle>
            <CardDescription>
              These fields were extracted with high confidence
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {highConfidence.map(field => renderField(field, false))}
          </CardContent>
        </Card>
      )}

      {/* Not Extracted */}
      {noValue.length > 0 && (
        <Card className="border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-gray-600">
              <Sparkles className="h-5 w-5" />
              Not Found ({noValue.length})
            </CardTitle>
            <CardDescription>
              These fields could not be extracted - you can enter values manually or try re-extraction
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {noValue.map(field => renderField(field, true))}
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Total: {fields.length} fields | 
          High: {highConfidence.length} | 
          Medium: {mediumConfidence.length} | 
          Low: {lowConfidence.length} | 
          Missing: {noValue.length}
        </span>
        {feedbackGiven.size > 0 && (
          <span className="text-green-600">
            {feedbackGiven.size} feedback{feedbackGiven.size > 1 ? "s" : ""} recorded
          </span>
        )}
      </div>
    </div>
  );
}

export default SmartReExtraction;
