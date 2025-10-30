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
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Additional global error handling logic
    console.error('[Global Error]', {
      error,
      errorInfo,
      timestamp: new Date().toISOString(),
    });
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
