'use client';

/**
 * Error Boundary for AI Chat
 * Catches rendering errors and provides a recovery UI
 */

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AIChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AI Chat Error]', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-md w-full mx-4 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">AI Chat Encountered an Error</h2>
          <p className="text-muted-foreground text-sm">
            Something went wrong while loading the chat. Your conversation history is safe.
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
