'use client';

import React from 'react';
import { ErrorBoundary } from '@/components/error-boundary/ErrorBoundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Upload, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
/**
 * Upload-specific error boundary with contextual recovery options.
 *
 * - Logs the error via console.error (avoids logger crash cascade)
 * - Offers "Try Again" (resets boundary) and "Back to Contracts" navigation
 * - Reassures the user that already-uploaded files are safe
 */
export function UploadErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        try {
          console.error('[UploadErrorBoundary]', error.message, errorInfo.componentStack?.slice(0, 500));
        } catch {
          // Never crash inside the error handler
        }
      }}
      fallback={<UploadErrorFallback />}
    >
      {children}
    </ErrorBoundary>
  );
}

function UploadErrorFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/40 dark:from-slate-900 dark:via-purple-950/30 dark:to-purple-950/40 flex items-center justify-center p-6">
      <Card className="max-w-lg w-full shadow-xl border-0 dark:border dark:border-slate-700/50">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" aria-hidden="true" />
          </div>
          <CardTitle className="text-xl">Upload Page Error</CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Something went wrong while preparing the upload interface.
            Any files that were already uploaded are safe.
          </p>
        </CardHeader>

        <CardContent className="flex flex-col items-center gap-3 pt-2">
          <Button
            onClick={() => window.location.reload()}
            className="w-full gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try Again
          </Button>

          <Button variant="outline" asChild className="w-full gap-2">
            <Link href="/contracts">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Contracts
            </Link>
          </Button>

          <p className="text-xs text-slate-400 mt-2 text-center">
            If this keeps happening, try clearing your browser cache or contact support.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default UploadErrorBoundary;
