"use client";

/**
 * TruncatedText Component
 * 
 * Handles text that may be too long with expand/collapse functionality.
 * Supports both character limits and line clamps.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

// ============================================================================
// Types
// ============================================================================

export interface TruncatedTextProps {
  /** Text content to display */
  text: string;
  /** Maximum characters before truncation (character-based mode) */
  maxLength?: number;
  /** Maximum lines before truncation (line-clamp mode) */
  maxLines?: number;
  /** Show expand/collapse button */
  expandable?: boolean;
  /** Show full text in tooltip when collapsed */
  showTooltip?: boolean;
  /** Text for expand button */
  expandText?: string;
  /** Text for collapse button */
  collapseText?: string;
  /** Ellipsis string */
  ellipsis?: string;
  /** Additional className */
  className?: string;
  /** Text element className */
  textClassName?: string;
  /** Controlled expanded state */
  expanded?: boolean;
  /** Callback when expanded state changes */
  onExpandChange?: (expanded: boolean) => void;
}

// ============================================================================
// TruncatedText Component (Character-based)
// ============================================================================

export function TruncatedText({
  text,
  maxLength = 150,
  expandable = true,
  showTooltip = true,
  expandText = "Show more",
  collapseText = "Show less",
  ellipsis = "...",
  className,
  textClassName,
  expanded: controlledExpanded,
  onExpandChange,
}: TruncatedTextProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;
  
  const isTruncated = text.length > maxLength;
  const displayText = isExpanded || !isTruncated 
    ? text 
    : text.slice(0, maxLength).trimEnd() + ellipsis;

  const toggleExpanded = useCallback(() => {
    const newValue = !isExpanded;
    if (!isControlled) {
      setInternalExpanded(newValue);
    }
    onExpandChange?.(newValue);
  }, [isExpanded, isControlled, onExpandChange]);

  const textElement = (
    <span className={cn("whitespace-pre-wrap", textClassName)}>
      {displayText}
    </span>
  );

  return (
    <div className={cn("inline", className)}>
      {showTooltip && isTruncated && !isExpanded ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {textElement}
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <p className="whitespace-pre-wrap">{text}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        textElement
      )}
      
      {isTruncated && expandable && (
        <Button
          variant="link"
          size="sm"
          onClick={toggleExpanded}
          className="h-auto p-0 ml-1 text-xs font-medium"
        >
          {isExpanded ? collapseText : expandText}
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// LineClampText Component (CSS-based line clamping)
// ============================================================================

export interface LineClampTextProps {
  /** Text content to display */
  text: string;
  /** Maximum lines before truncation */
  lines?: number;
  /** Show expand/collapse button */
  expandable?: boolean;
  /** Show full text in tooltip when collapsed */
  showTooltip?: boolean;
  /** Text for expand button */
  expandText?: string;
  /** Text for collapse button */
  collapseText?: string;
  /** Additional className */
  className?: string;
  /** Controlled expanded state */
  expanded?: boolean;
  /** Callback when expanded state changes */
  onExpandChange?: (expanded: boolean) => void;
}

export function LineClampText({
  text,
  lines = 2,
  expandable = true,
  showTooltip = true,
  expandText = "Show more",
  collapseText = "Show less",
  className,
  expanded: controlledExpanded,
  onExpandChange,
}: LineClampTextProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;

  // Check if text is actually truncated
  useEffect(() => {
    const element = textRef.current;
    if (element && !isExpanded) {
      setIsTruncated(element.scrollHeight > element.clientHeight);
    }
  }, [text, lines, isExpanded]);

  const toggleExpanded = useCallback(() => {
    const newValue = !isExpanded;
    if (!isControlled) {
      setInternalExpanded(newValue);
    }
    onExpandChange?.(newValue);
  }, [isExpanded, isControlled, onExpandChange]);

  const lineClampStyles: React.CSSProperties = isExpanded
    ? {}
    : {
        display: "-webkit-box",
        WebkitLineClamp: lines,
        WebkitBoxOrient: "vertical" as const,
        overflow: "hidden",
      };

  const textElement = (
    <p
      ref={textRef}
      className={cn("whitespace-pre-wrap", className)}
      style={lineClampStyles}
    >
      {text}
    </p>
  );

  return (
    <div>
      {showTooltip && isTruncated && !isExpanded ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {textElement}
            </TooltipTrigger>
            <TooltipContent className="max-w-sm max-h-64 overflow-auto">
              <p className="whitespace-pre-wrap">{text}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        textElement
      )}
      
      {isTruncated && expandable && (
        <Button
          variant="link"
          size="sm"
          onClick={toggleExpanded}
          className="h-auto p-0 text-xs font-medium flex items-center gap-1"
        >
          {isExpanded ? (
            <>
              {collapseText} <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              {expandText} <ChevronDown className="h-3 w-3" />
            </>
          )}
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// ExpandableDescription Component - For card descriptions
// ============================================================================

export interface ExpandableDescriptionProps {
  /** Description text */
  description: string;
  /** Maximum lines in collapsed state */
  collapsedLines?: number;
  /** Title for accessibility */
  title?: string;
  /** Additional className */
  className?: string;
}

export function ExpandableDescription({
  description,
  collapsedLines = 2,
  title,
  className,
}: ExpandableDescriptionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsExpand, setNeedsExpand] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const element = descRef.current;
    if (element) {
      // Check if content overflows
      const lineHeight = parseInt(getComputedStyle(element).lineHeight);
      const maxHeight = lineHeight * collapsedLines;
      setNeedsExpand(element.scrollHeight > maxHeight + 2); // +2 for rounding
    }
  }, [description, collapsedLines]);

  return (
    <div className={cn("relative", className)}>
      <p
        ref={descRef}
        className={cn(
          "text-sm text-muted-foreground transition-all duration-200",
          !isExpanded && needsExpand && "line-clamp-2"
        )}
        style={
          !isExpanded && needsExpand
            ? {
                display: "-webkit-box",
                WebkitLineClamp: collapsedLines,
                WebkitBoxOrient: "vertical" as const,
                overflow: "hidden",
              }
            : undefined
        }
        title={title}
      >
        {description}
      </p>
      
      {needsExpand && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-primary hover:text-primary/80 font-medium mt-1 flex items-center gap-0.5 transition-colors"
        >
          {isExpanded ? (
            <>
              Less <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              More <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default TruncatedText;
