/**
 * Error Alert Component
 * User-friendly inline error display with retry functionality
 */

'use client';

import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ErrorAlertProps {
  error: Error | string;
  title?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  showDetails?: boolean;
  className?: string;
}

export function ErrorAlert({
  error,
  title = 'Error',
  onRetry,
  onDismiss,
  showDetails = false,
  className = '',
}: ErrorAlertProps) {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>{title}</span>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-6 w-6 p-0 hover:bg-destructive/20"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{getUserFriendlyMessage(errorMessage)}</p>
        
        {showDetails && isDevelopment && typeof error !== 'string' && (
          <details className="mt-2">
            <summary className="text-xs cursor-pointer hover:underline">
              Technical Details
            </summary>
            <pre className="mt-1 text-xs overflow-auto max-h-32 p-2 bg-destructive/10 rounded">
              {error.stack || errorMessage}
            </pre>
          </details>
        )}
        
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-2 flex items-center gap-2"
          >
            <RefreshCw className="h-3 w-3" />
            Try Again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Get user-friendly error message
 */
function getUserFriendlyMessage(message: string): string {
  const lowerMessage = message.toLowerCase();

  // Network errors
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }

  // Timeout errors
  if (lowerMessage.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  // Authentication errors
  if (lowerMessage.includes('401') || lowerMessage.includes('unauthorized')) {
    return 'Your session has expired. Please log in again.';
  }

  // Permission errors
  if (lowerMessage.includes('403') || lowerMessage.includes('forbidden')) {
    return "You don't have permission to perform this action.";
  }

  // Not found errors
  if (lowerMessage.includes('404') || lowerMessage.includes('not found')) {
    return 'The requested resource was not found.';
  }

  // Conflict errors
  if (lowerMessage.includes('409') || lowerMessage.includes('conflict')) {
    return 'This resource was modified by another user. Please refresh and try again.';
  }

  // Rate limit errors
  if (lowerMessage.includes('429') || lowerMessage.includes('rate limit')) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  // Server errors
  if (lowerMessage.includes('500') || lowerMessage.includes('internal server')) {
    return 'Server error. Our team has been notified and is working on a fix.';
  }

  // Return original message if no match
  return message;
}
