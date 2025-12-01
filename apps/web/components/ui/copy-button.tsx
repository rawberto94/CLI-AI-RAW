"use client";

/**
 * CopyButton Component
 * 
 * Reusable copy-to-clipboard button with feedback states.
 * Uses useCopyToClipboard hook under the hood.
 */

import React, { useCallback, useState } from "react";
import { Check, Copy, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

// ============================================================================
// Types
// ============================================================================

export interface CopyButtonProps {
  /** Text to copy to clipboard */
  value: string;
  /** Text to display in tooltip before copying */
  tooltipText?: string;
  /** Text to display in tooltip after copying */
  successText?: string;
  /** Text to display in tooltip on error */
  errorText?: string;
  /** Duration to show success state (ms) */
  successDuration?: number;
  /** Show toast notification on copy */
  showToast?: boolean;
  /** Toast message on success */
  toastMessage?: string;
  /** Custom icon when idle */
  icon?: React.ReactNode;
  /** Custom icon when copied */
  successIcon?: React.ReactNode;
  /** Hide tooltip */
  hideTooltip?: boolean;
  /** Callback on successful copy */
  onCopy?: (value: string) => void;
  /** Callback on copy error */
  onError?: (error: Error) => void;
  /** Custom children (replaces icon) */
  children?: React.ReactNode;
  /** Button variant */
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
  /** Additional className */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
}

// ============================================================================
// CopyButton Component
// ============================================================================

export function CopyButton({
  value,
  tooltipText = "Copy to clipboard",
  successText = "Copied!",
  errorText = "Failed to copy",
  successDuration = 2000,
  showToast = false,
  toastMessage,
  icon,
  successIcon,
  hideTooltip = false,
  onCopy,
  onError,
  className,
  variant = "ghost",
  size = "icon",
  children,
  disabled,
}: CopyButtonProps) {
  const [error, setError] = useState(false);
  const { copied, copy } = useCopyToClipboard({
    successMessage: showToast ? toastMessage : undefined,
    resetDelay: successDuration,
  });

  const handleCopy = useCallback(async () => {
    setError(false);
    const success = await copy(value);
    if (success) {
      onCopy?.(value);
    } else {
      setError(true);
      onError?.(new Error(errorText));
      setTimeout(() => setError(false), successDuration);
    }
  }, [copy, value, onCopy, errorText, onError, successDuration]);

  const currentIcon = copied 
    ? (successIcon || <Check className="h-4 w-4 text-green-500" />)
    : error
    ? <AlertCircle className="h-4 w-4 text-red-500" />
    : (icon || <Copy className="h-4 w-4" />);

  const tooltipContent = copied ? successText : error ? errorText : tooltipText;

  const button = (
    <Button
      variant={variant}
      size={size}
      onClick={handleCopy}
      disabled={disabled}
      className={cn(
        "transition-colors",
        copied && "text-green-500",
        error && "text-red-500",
        className
      )}
    >
      {children || currentIcon}
    </Button>
  );

  if (hideTooltip) {
    return button;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {button}
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// CopyText Component - Inline text with copy button
// ============================================================================

export interface CopyTextProps {
  /** Text to display and copy */
  text: string;
  /** Label before the text */
  label?: string;
  /** Max width before truncation */
  maxWidth?: string | number;
  /** Show full text in tooltip when truncated */
  showFullInTooltip?: boolean;
  /** Additional className */
  className?: string;
  /** Copy button props */
  copyButtonProps?: Partial<CopyButtonProps>;
}

export function CopyText({
  text,
  label,
  maxWidth = "200px",
  showFullInTooltip = true,
  className,
  copyButtonProps,
}: CopyTextProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <code
              className="text-sm bg-muted px-2 py-1 rounded truncate"
              style={{ maxWidth: typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth }}
            >
              {text}
            </code>
          </TooltipTrigger>
          {showFullInTooltip && (
            <TooltipContent>
              <p className="max-w-xs break-all font-mono text-xs">{text}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
      <CopyButton value={text} size="sm" {...copyButtonProps} />
    </div>
  );
}

// ============================================================================
// CopyCodeBlock Component - For code snippets
// ============================================================================

export interface CopyCodeBlockProps {
  /** Code content */
  code: string;
  /** Language for syntax highlighting hint */
  language?: string;
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Max height before scrolling */
  maxHeight?: string | number;
  /** Additional className */
  className?: string;
}

export function CopyCodeBlock({
  code,
  language,
  showLineNumbers = false,
  maxHeight = "300px",
  className,
}: CopyCodeBlockProps) {
  const lines = code.split("\n");

  return (
    <div className={cn("relative group", className)}>
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton
          value={code}
          variant="secondary"
          size="sm"
          tooltipText="Copy code"
          successText="Code copied!"
        />
      </div>
      {language && (
        <div className="absolute left-3 top-2 text-xs text-muted-foreground uppercase">
          {language}
        </div>
      )}
      <pre
        className="bg-muted rounded-lg p-4 pt-8 overflow-auto text-sm font-mono"
        style={{ maxHeight: typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight }}
      >
        <code>
          {showLineNumbers
            ? lines.map((line, i) => (
                <div key={i} className="flex">
                  <span className="text-muted-foreground w-8 flex-shrink-0 select-none">
                    {i + 1}
                  </span>
                  <span>{line}</span>
                </div>
              ))
            : code}
        </code>
      </pre>
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default CopyButton;
