/**
 * Global Error Boundary
 * Top-level error boundary that catches all React errors in the application
 */

'use client';

import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { GlobalErrorFallback } from './GlobalErrorFallback';

interface GlobalErrorBoundaryProps {
  children: React.ReactNode;
}

export function GlobalErrorBoundary({ children }: GlobalErrorBoundaryProps) {
  const handleError = (_error: Error, _errorInfo: React.ErrorInfo) => {
    // Additional global error handling logic can be added here
  };

  return (
    <ErrorBoundary
      fallback={GlobalErrorFallback}
      onError={handleError}
      level="page"
    >
      {children}
    </ErrorBoundary>
  );
}
