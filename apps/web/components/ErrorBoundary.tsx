"use client";

/**
 * Error Boundary Component
 * 
 * Catches JavaScript errors in child component tree and displays
 * a fallback UI instead of crashing the entire application.
 * 
 * @example
 * <ErrorBoundary fallback={<ErrorFallback />}>
 *   <MyComponent />
 * </ErrorBoundary>
 * 
 * @example
 * // With error callback
 * <ErrorBoundary
 *   onError={(error, errorInfo) => logErrorToService(error, errorInfo)}
 * >
 *   <MyComponent />
 * </ErrorBoundary>
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react";
import Link from "next/link";

// ============================================================================
// Types
// ============================================================================

export interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Custom fallback UI to display when an error occurs */
  fallback?: ReactNode;
  /** Fallback render function with error details */
  fallbackRender?: (props: FallbackProps) => ReactNode;
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Callback when reset is triggered */
  onReset?: () => void;
  /** Keys that trigger a reset when changed */
  resetKeys?: unknown[];
  /** Whether to show detailed error info (dev mode) */
  showDetails?: boolean;
}

export interface FallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  resetError: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ============================================================================
// Default Fallback Component
// ============================================================================

interface DefaultFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  resetError: () => void;
  showDetails?: boolean;
}

function DefaultFallback({ error, errorInfo, resetError, showDetails }: DefaultFallbackProps) {
  const isDev = process.env.NODE_ENV === "development";
  const showStack = showDetails ?? isDev;

  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
        {/* Icon */}
        <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Something went wrong
        </h2>

        {/* Description */}
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          We encountered an unexpected error. Please try again or return to the home page.
        </p>

        {/* Error Message */}
        {showStack && (
          <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-700 rounded text-left">
            <p className="text-sm font-mono text-red-600 dark:text-red-400 break-all">
              {error.message}
            </p>
            {errorInfo?.componentStack && (
              <details className="mt-2">
                <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                  Component Stack
                </summary>
                <pre className="mt-2 text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-32">
                  {errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={resetError}
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            <Home className="w-4 h-4 mr-2" />
            Go Home
          </Link>
        </div>

        {/* Report Bug Link */}
        {isDev && (
          <button
            onClick={() => {
              console.group("Error Report");
              console.error("Error:", error);
              console.error("Component Stack:", errorInfo?.componentStack);
              console.groupEnd();
            }}
            className="mt-4 inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <Bug className="w-4 h-4 mr-1" />
            Log Error Details
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Error Boundary Class Component
// ============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset error state if resetKeys change
    if (this.state.hasError && this.props.resetKeys) {
      const hasKeyChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      if (hasKeyChanged) {
        this.resetError();
      }
    }
  }

  resetError = (): void => {
    this.props.onReset?.();
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  override render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, fallbackRender, showDetails } = this.props;

    if (hasError && error) {
      // Custom render function
      if (fallbackRender) {
        return fallbackRender({
          error,
          errorInfo,
          resetError: this.resetError,
        });
      }

      // Custom fallback element
      if (fallback) {
        return fallback;
      }

      // Default fallback
      return (
        <DefaultFallback
          error={error}
          errorInfo={errorInfo}
          resetError={this.resetError}
          showDetails={showDetails}
        />
      );
    }

    return children;
  }
}

// ============================================================================
// Specialized Error Boundaries
// ============================================================================

/**
 * Error boundary specifically for page-level errors
 */
export function PageErrorBoundary({
  children,
  onError,
}: {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}) {
  return (
    <ErrorBoundary
      onError={onError}
      fallbackRender={({ error, resetError }) => (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-lg w-full">
            <DefaultFallback
              error={error}
              errorInfo={null}
              resetError={resetError}
              showDetails={process.env.NODE_ENV === "development"}
            />
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Error boundary for async content/suspense boundaries
 */
export function AsyncBoundary({
  children,
  fallback,
  onError,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}) {
  return (
    <ErrorBoundary
      onError={onError}
      fallback={
        fallback || (
          <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">
              Failed to load content. Please try again.
            </p>
          </div>
        )
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Error boundary for form sections
 */
export function FormErrorBoundary({
  children,
  sectionName,
}: {
  children: ReactNode;
  sectionName?: string;
}) {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">
            {sectionName
              ? `Error loading ${sectionName}. Please refresh the page.`
              : "Error loading form section. Please refresh the page."}
          </p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

// ============================================================================
// Hook for manual error triggering
// ============================================================================

/**
 * Hook to manually trigger error boundary
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  if (error) {
    throw error;
  }

  const triggerError = React.useCallback((err: Error | string) => {
    setError(err instanceof Error ? err : new Error(err));
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return { triggerError, clearError };
}

/**
 * HOC to wrap a component with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${
    Component.displayName || Component.name || "Component"
  })`;

  return WrappedComponent;
}

// ============================================================================
// Exports
// ============================================================================

export default ErrorBoundary;
