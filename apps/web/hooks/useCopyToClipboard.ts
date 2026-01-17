'use client';

/**
 * useCopyToClipboard Hook
 * 
 * A reusable hook for copying text to clipboard with toast notifications
 * and copied state management.
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface CopyToClipboardOptions {
  /** Success message to show in toast */
  successMessage?: string;
  /** Error message to show in toast */
  errorMessage?: string;
  /** Duration in ms to keep copied state true */
  resetDelay?: number;
  /** Whether to show toast notifications */
  showToast?: boolean;
}

interface CopyToClipboardReturn {
  /** Whether content was recently copied */
  copied: boolean;
  /** Function to copy text to clipboard */
  copy: (text: string) => Promise<boolean>;
  /** Reset copied state */
  reset: () => void;
}

export function useCopyToClipboard(
  options: CopyToClipboardOptions = {}
): CopyToClipboardReturn {
  const {
    successMessage = 'Copied to clipboard!',
    errorMessage = 'Failed to copy to clipboard',
    resetDelay = 2000,
    showToast = true,
  } = options;

  const [copied, setCopied] = useState(false);

  const reset = useCallback(() => {
    setCopied(false);
  }, []);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      if (!navigator?.clipboard) {
        if (showToast) {
          toast.error('Clipboard API not available');
        }
        return false;
      }

      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);

        if (showToast) {
          toast.success(successMessage);
        }

        // Reset copied state after delay
        if (resetDelay > 0) {
          setTimeout(() => {
            setCopied(false);
          }, resetDelay);
        }

        return true;
      } catch {
        setCopied(false);

        if (showToast) {
          toast.error(errorMessage);
        }

        return false;
      }
    },
    [successMessage, errorMessage, resetDelay, showToast]
  );

  return { copied, copy, reset };
}

/**
 * Utility function for one-off clipboard operations
 */
export async function copyToClipboard(
  text: string,
  options: { showToast?: boolean; successMessage?: string } = {}
): Promise<boolean> {
  const { showToast = true, successMessage = 'Copied!' } = options;

  try {
    await navigator.clipboard.writeText(text);
    if (showToast) {
      toast.success(successMessage);
    }
    return true;
  } catch {
    if (showToast) {
      toast.error('Failed to copy to clipboard');
    }
    return false;
  }
}
