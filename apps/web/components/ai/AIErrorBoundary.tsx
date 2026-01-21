"use client";

/**
 * AI Error Boundary Component
 * 
 * Provides graceful error handling for AI-related components.
 * Captures errors, logs them, and displays user-friendly fallbacks.
 */

import React, { Component, ReactNode, useState, useCallback } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Bug,
  MessageSquare,
  Copy,
  Check,
  ExternalLink,
  Home,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// Types
interface ErrorInfo {
  componentStack: string;
}

interface AIErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
  showDetails?: boolean;
  errorTitle?: string;
  errorDescription?: string;
}

interface AIErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// Error Boundary Class Component
export class AIErrorBoundary extends Component<AIErrorBoundaryProps, AIErrorBoundaryState> {
  constructor(props: AIErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<AIErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console
    console.error('[AIErrorBoundary] Caught error:', error);
    console.error('[AIErrorBoundary] Component stack:', errorInfo.componentStack);

    // Update state with error info
    this.setState({
      errorInfo: { componentStack: errorInfo.componentStack || '' },
    });

    // Call custom error handler
    this.props.onError?.(error, { componentStack: errorInfo.componentStack || '' });

    // Log to analytics/monitoring service
    this.logError(error, errorInfo);
  }

  private logError(error: Error, errorInfo: React.ErrorInfo) {
    // In production, send to error tracking service
    try {
      // Example: Send to API endpoint
      fetch('/api/errors/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ai_component_error',
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          url: typeof window !== 'undefined' ? window.location.href : '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        }),
      }).catch(() => {
        // Silently fail - don't want error logging to cause more errors
      });
    } catch {
      // Silently fail
    }
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <AIErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
          showDetails={this.props.showDetails}
          title={this.props.errorTitle}
          description={this.props.errorDescription}
        />
      );
    }

    return this.props.children;
  }
}

// Error Fallback Component
interface AIErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReset?: () => void;
  showDetails?: boolean;
  title?: string;
  description?: string;
  variant?: 'full' | 'inline' | 'minimal';
}

export function AIErrorFallback({
  error,
  errorInfo,
  onReset,
  showDetails = true,
  title = 'Something went wrong',
  description = 'We encountered an error while processing your request.',
  variant = 'full',
}: AIErrorFallbackProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyError = useCallback(async () => {
    const errorText = `
Error: ${error?.message || 'Unknown error'}
Stack: ${error?.stack || 'No stack trace'}
Component Stack: ${errorInfo?.componentStack || 'No component stack'}
    `.trim();

    try {
      await navigator.clipboard.writeText(errorText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      console.error('Failed to copy error');
    }
  }, [error, errorInfo]);

  // Minimal variant - just a message
  if (variant === 'minimal') {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 p-2">
        <AlertTriangle className="w-4 h-4" />
        <span>Error loading component</span>
        {onReset && (
          <button onClick={onReset} className="underline hover:no-underline">
            Retry
          </button>
        )}
      </div>
    );
  }

  // Inline variant - compact display
  if (variant === 'inline') {
    return (
      <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-full">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="font-medium text-red-800">{title}</p>
            <p className="text-sm text-red-600">{description}</p>
          </div>
        </div>
        {onReset && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="border-red-200 text-red-700 hover:bg-red-100"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  // Full variant - detailed display
  return (
    <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm max-w-lg mx-auto">
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="p-3 bg-red-100 rounded-full mb-4">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
        <p className="text-slate-500 mt-1">{description}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-3 mb-6">
        {onReset && (
          <Button onClick={onReset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        )}
        <Button variant="outline" asChild>
          <a href="/">
            <Home className="w-4 h-4 mr-2" />
            Go Home
          </a>
        </Button>
      </div>

      {/* Error Details */}
      {showDetails && error && (
        <Collapsible open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-center gap-2 w-full py-2 text-sm text-slate-500 hover:text-slate-700">
              <Bug className="w-4 h-4" />
              <span>Technical Details</span>
              {isDetailsOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 uppercase">
                  Error Message
                </span>
                <button
                  onClick={handleCopyError}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3 h-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="text-xs text-red-600 whitespace-pre-wrap break-all font-mono">
                {error.message}
              </pre>
              
              {error.stack && (
                <div className="mt-4">
                  <span className="text-xs font-medium text-slate-500 uppercase">
                    Stack Trace
                  </span>
                  <pre className="mt-1 text-xs text-slate-600 whitespace-pre-wrap break-all font-mono max-h-32 overflow-y-auto">
                    {error.stack}
                  </pre>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Help Link */}
      <div className="mt-6 pt-4 border-t border-slate-100 text-center">
        <p className="text-sm text-slate-500">
          Need help?{' '}
          <a
            href="/support"
            className="text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            Contact Support
            <ExternalLink className="w-3 h-3" />
          </a>
        </p>
      </div>
    </div>
  );
}

// Specialized Error Boundaries for specific AI components
export function ChatErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <AIErrorBoundary
      errorTitle="Chat Error"
      errorDescription="Unable to load the AI chat. Please try refreshing."
      onError={(error) => {
        console.error('[Chat] Error:', error);
      }}
    >
      {children}
    </AIErrorBoundary>
  );
}

export function AnalyticsErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <AIErrorBoundary
      errorTitle="Analytics Error"
      errorDescription="Unable to load AI analytics dashboard."
      fallback={
        <div className="p-8 text-center text-slate-500">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
          <p className="font-medium">Analytics Unavailable</p>
          <p className="text-sm mt-1">Please try again later.</p>
        </div>
      }
    >
      {children}
    </AIErrorBoundary>
  );
}

export function SuggestionsErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <AIErrorBoundary
      errorTitle="Suggestions Error"
      errorDescription="Unable to generate smart suggestions."
      fallback={
        <div className="p-4 bg-slate-50 rounded-lg text-center text-slate-500 text-sm">
          <p>Suggestions temporarily unavailable</p>
        </div>
      }
      showDetails={false}
    >
      {children}
    </AIErrorBoundary>
  );
}

// Hook for programmatic error handling
export function useErrorHandler() {
  const [error, setError] = useState<Error | null>(null);

  const handleError = useCallback((err: Error | unknown) => {
    const error = err instanceof Error ? err : new Error(String(err));
    setError(error);
    console.error('[useErrorHandler]', error);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const wrapAsync = useCallback(
    <T,>(fn: () => Promise<T>) => {
      return async () => {
        try {
          return await fn();
        } catch (err) {
          handleError(err);
          return undefined;
        }
      };
    },
    [handleError]
  );

  return {
    error,
    handleError,
    clearError,
    wrapAsync,
    hasError: error !== null,
  };
}

// HOC for adding error boundary to any component
export function withAIErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<AIErrorBoundaryProps, 'children'>
) {
  return function WrappedComponent(props: P) {
    return (
      <AIErrorBoundary {...options}>
        <Component {...props} />
      </AIErrorBoundary>
    );
  };
}

export default AIErrorBoundary;
