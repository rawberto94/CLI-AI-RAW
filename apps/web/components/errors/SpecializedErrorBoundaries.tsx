/**
 * Specialized Error Boundaries
 * Provides context-specific error handling for different parts of the application
 */

'use client';

import React, { Component, ReactNode, useState, useCallback } from 'react';
import { AlertCircle, RefreshCw, WifiOff, Server, FileWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// ============================================================================
// Types
// ============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ============================================================================
// Base Error Boundary
// ============================================================================

export class BaseErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error!, this.reset);
      }
      return this.props.fallback || <DefaultErrorFallback error={this.state.error!} reset={this.reset} />;
    }
    return this.props.children;
  }
}

// ============================================================================
// Default Fallback
// ============================================================================

function DefaultErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex items-center justify-center p-8">
      <Alert variant="destructive" className="max-w-md">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="text-sm mb-4">{error.message || 'An unexpected error occurred'}</p>
          <Button onClick={reset} size="sm" variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}

// ============================================================================
// Network Error Boundary
// ============================================================================

interface NetworkErrorFallbackProps {
  error: Error;
  reset: () => void;
  retrying?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function NetworkErrorFallback({ error: _error, reset, retrying }: NetworkErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <WifiOff className="h-12 w-12 text-orange-500 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Connection Issue
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-sm">
        Unable to connect to the server. Please check your internet connection and try again.
      </p>
      <Button onClick={reset} disabled={retrying}>
        {retrying ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Reconnecting...
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry Connection
          </>
        )}
      </Button>
    </div>
  );
}

export class NetworkErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState & { retrying: boolean }> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, retrying: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Only catch network-related errors
    if (error.message.includes('network') || 
        error.message.includes('fetch') || 
        error.message.includes('NETWORK_ERROR')) {
      return { hasError: true, error };
    }
    throw error; // Re-throw non-network errors
  }

  override componentDidCatch(_error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(_error, errorInfo);
  }

  reset = () => {
    this.setState({ retrying: true });
    
    // Wait a bit before resetting to show loading state
    setTimeout(() => {
      this.setState({ hasError: false, error: null, retrying: false });
    }, 1000);
  };

  override render() {
    if (this.state.hasError) {
      return (
        <NetworkErrorFallback 
          error={this.state.error!} 
          reset={this.reset} 
          retrying={this.state.retrying}
        />
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// API Error Boundary
// ============================================================================

function ApiErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  const is404 = error.message.includes('404') || error.message.includes('NOT_FOUND');
  const is403 = error.message.includes('403') || error.message.includes('FORBIDDEN');
  const is500 = error.message.includes('500') || error.message.includes('SERVER_ERROR');

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <Server className="h-12 w-12 text-red-500 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {is404 ? 'Not Found' : is403 ? 'Access Denied' : is500 ? 'Server Error' : 'Request Failed'}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-sm">
        {is404 ? 'The requested resource could not be found.' :
         is403 ? 'You don\'t have permission to access this resource.' :
         is500 ? 'The server encountered an error. Please try again later.' :
         error.message || 'The request could not be completed.'}
      </p>
      <Button onClick={reset}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Try Again
      </Button>
    </div>
  );
}

export class ApiErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Catch API-related errors
    if (error.message.includes('HTTP_') || 
        error.message.includes('API_') ||
        error.message.includes('CIRCUIT_OPEN')) {
      return { hasError: true, error };
    }
    throw error;
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      return <ApiErrorFallback error={this.state.error!} reset={this.reset} />;
    }
    return this.props.children;
  }
}

// ============================================================================
// Component Error Boundary (for specific components)
// ============================================================================

function ComponentErrorFallback({ 
  error, 
  reset, 
  componentName 
}: { 
  error: Error; 
  reset: () => void; 
  componentName?: string;
}) {
  return (
    <div className="border border-dashed border-red-300 dark:border-red-800 rounded-lg p-4 bg-red-50 dark:bg-red-900/20">
      <div className="flex items-start gap-3">
        <FileWarning className="h-5 w-5 text-red-500 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
            {componentName ? `${componentName} failed to load` : 'Component Error'}
          </h4>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            {error.message || 'This component encountered an error.'}
          </p>
          <Button 
            onClick={reset} 
            variant="ghost" 
            size="sm" 
            className="mt-2 text-red-600 hover:text-red-700"
          >
            <RefreshCw className="mr-2 h-3 w-3" />
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ComponentErrorBoundaryProps extends ErrorBoundaryProps {
  componentName?: string;
}

export class ComponentErrorBoundary extends Component<
  ComponentErrorBoundaryProps, 
  ErrorBoundaryState
> {
  constructor(props: ComponentErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      return (
        <ComponentErrorFallback 
          error={this.state.error!} 
          reset={this.reset}
          componentName={this.props.componentName}
        />
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// Query Error Boundary (for React Query)
// ============================================================================

interface QueryErrorBoundaryProps extends ErrorBoundaryProps {
  queryKey?: unknown[];
}

export function QueryErrorBoundary({ 
  children, 
  fallback, 
  onError,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  queryKey: _queryKey 
}: QueryErrorBoundaryProps) {
  const [error, setError] = useState<Error | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleError = useCallback((err: Error) => {
    setError(err);
    onError?.(err, { componentStack: '' });
  }, [onError]);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  if (error) {
    if (typeof fallback === 'function') {
      return <>{fallback(error, reset)}</>;
    }
    return <>{fallback}</> || <DefaultErrorFallback error={error} reset={reset} />;
  }

  return <>{children}</>;
}

// ============================================================================
// Suspense with Error Boundary
// ============================================================================

interface SuspenseWithErrorProps {
  children: ReactNode;
  fallback?: ReactNode;
  errorFallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export function SuspenseWithError({ 
  children, 
  fallback, 
  errorFallback,
  onError 
}: SuspenseWithErrorProps) {
  return (
    <BaseErrorBoundary fallback={errorFallback} onError={onError}>
      <React.Suspense fallback={fallback || <DefaultLoadingFallback />}>
        {children}
      </React.Suspense>
    </BaseErrorBoundary>
  );
}

function DefaultLoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-pulse space-y-4 w-full max-w-md">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
      </div>
    </div>
  );
}

// ============================================================================
// HOC: withErrorBoundary
// ============================================================================

export function withErrorBoundary<P extends Record<string, unknown>>(
  Component: React.ComponentType<P>,
  boundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <BaseErrorBoundary {...boundaryProps}>
      <Component {...props} />
    </BaseErrorBoundary>
  );

  WrappedComponent.displayName = `WithErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// ============================================================================
// Hook: useErrorBoundary
// ============================================================================

export function useErrorBoundary() {
  const [error, setError] = useState<Error | null>(null);

  const showBoundary = useCallback((error: Error) => {
    setError(error);
  }, []);

  const resetBoundary = useCallback(() => {
    setError(null);
  }, []);

  // Throw error to be caught by nearest error boundary
  if (error) {
    throw error;
  }

  return { showBoundary, resetBoundary };
}
