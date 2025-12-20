'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showStack: boolean;
}

/**
 * React Error Boundary component for graceful error handling.
 * 
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * 
 * // With custom fallback
 * <ErrorBoundary fallback={<CustomErrorUI />}>
 *   <YourComponent />
 * </ErrorBoundary>
 * 
 * // With error logging
 * <ErrorBoundary onError={(error, info) => logToService(error, info)}>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showStack: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleGoHome = (): void => {
    window.location.href = '/';
  };

  private toggleStack = (): void => {
    this.setState((prev) => ({ showStack: !prev.showStack }));
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, showStack } = this.state;
      const isDev = process.env.NODE_ENV === 'development';
      const showDetails = this.props.showDetails ?? isDev;

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <Card className="max-w-lg w-full">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-xl text-slate-900 dark:text-white">
                Something went wrong
              </CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                {error?.message || 'An unexpected error occurred'}
              </p>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Action Buttons */}
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={this.handleRetry}
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={this.handleGoHome}
                  className="gap-2"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </Button>
              </div>

              {/* Error Details (Development) */}
              {showDetails && error && (
                <div className="mt-4">
                  <button
                    onClick={this.toggleStack}
                    className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors w-full"
                    aria-expanded={showStack}
                  >
                    {showStack ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    {showStack ? 'Hide' : 'Show'} error details
                  </button>

                  {showStack && (
                    <div className="mt-3 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-auto max-h-64">
                      <p className="text-xs font-mono text-red-600 dark:text-red-400 mb-2">
                        {error.name}: {error.message}
                      </p>
                      {error.stack && (
                        <pre className="text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                          {error.stack}
                        </pre>
                      )}
                      {errorInfo?.componentStack && (
                        <>
                          <p className="text-xs font-mono text-slate-500 mt-4 mb-2">
                            Component Stack:
                          </p>
                          <pre className="text-xs font-mono text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                            {errorInfo.componentStack}
                          </pre>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap a component with error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}

/**
 * Async Error Boundary for handling async errors
 */
export function AsyncErrorBoundary({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <ErrorBoundary
      fallback={
        fallback || (
          <div className="flex items-center justify-center p-8">
            <Card className="max-w-md">
              <CardContent className="pt-6 text-center">
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Failed to Load</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  There was a problem loading this content.
                </p>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                >
                  Reload Page
                </Button>
              </CardContent>
            </Card>
          </div>
        )
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
