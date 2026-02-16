'use client';

/**
 * Error Boundary for Dashboard Route Group
 * Catches rendering errors in agents, analytics, settings, etc.
 */

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function DashboardGroupError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Dashboard Group Error]', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full mx-4 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Something Went Wrong</h2>
          <p className="text-muted-foreground text-sm">
            An unexpected error occurred. Your data is safe — please try again.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button onClick={reset} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          <Link href="/dashboard">
            <Button variant="outline" className="w-full gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
        {error.digest && (
          <p className="text-xs text-muted-foreground">Error ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
